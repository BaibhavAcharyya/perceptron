export async function POST() {
    // Simulate a server-side error
    throw new Error("API error: Something went wrong on the server!");
}