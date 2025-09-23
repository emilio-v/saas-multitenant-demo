import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { TenantManager } from "@/db/config/tenant-manager";
import { getTenantDb } from "@/db/config/database";
import { createUsersTable } from "@/db/schemas/tenant";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  console.log("🎣 [Webhook] Received Clerk webhook request");

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log("❌ [Webhook] Missing svix headers");
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.text();
  const _body = JSON.parse(payload);

  // Create a new Svix instance with your secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log("❌ [Webhook] No webhook secret configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("❌ [Webhook] Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  console.log("✅ [Webhook] Verified event:", evt.type);

  // Handle the organization.created event
  if (evt.type === "organization.created") {
    const { id, name, slug, created_by } = evt.data;

    console.log("🏢 [Webhook] Organization created:", {
      id,
      name,
      slug,
      created_by,
    });

    try {
      // Create tenant in our database
      const result = await TenantManager.createTenant(
        id,
        name,
        slug ||
          name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
      );
      console.log("✅ [Webhook] Tenant created successfully:", result);

      // Get the creator's user information from Clerk
      console.log("👤 [Webhook] Creating owner user in tenant schema...");

      if (!created_by) {
        throw new Error("No created_by user ID provided in webhook");
      }

      const clerk = await clerkClient();
      const user = await clerk.users.getUser(created_by);

      // Create the owner user in the tenant schema
      const tenantDb = getTenantDb(result.schemaName);
      const users = createUsersTable(result.schemaName);

      await tenantDb.insert(users).values({
        id: user.id,
        email: user.emailAddresses[0].emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.imageUrl,
        role: "owner",
        metadata: { onboardingComplete: false },
      });

      console.log("✅ [Webhook] Owner user created in tenant schema");

      return NextResponse.json({
        success: true,
        message: "Organization synced and owner created",
        tenant: result,
      });
    } catch (error) {
      console.error("❌ [Webhook] Failed to create tenant or user:", error);
      return NextResponse.json(
        { error: "Failed to sync organization" },
        { status: 500 }
      );
    }
  }

  // Handle organization.updated event
  if (evt.type === "organization.updated") {
    const { id, name, slug } = evt.data;
    console.log("🔄 [Webhook] Organization updated:", { id, name, slug });
    // Could update tenant data here if needed
  }

  console.log("ℹ️ [Webhook] Event processed:", evt.type);
  return NextResponse.json({ received: true });
}
