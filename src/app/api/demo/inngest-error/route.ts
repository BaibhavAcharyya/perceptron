import { inngest } from "@/inngest/client";

export async function POST() {
    // Trigger an error in an Inngest background job
    await inngest.send({ name: "demo/error",data: {}});
    
    return Response.json({ status: "started" });
}