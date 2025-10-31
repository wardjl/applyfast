import { ScrapeCompletionEmail } from "../../../convex/emailTemplates";
import { render } from "@react-email/render";

export const dynamic = 'force-dynamic';

export default async function PreviewScrapeCompletion() {
  const testData = {
    scrapeName: "Senior React Developer - San Francisco",
    totalJobs: 47,
    dashboardUrl: "https://applyfa.st/dashboard/jobs?scrape=scrape_123",
    scrapeId: "kg123abc456def789",
  };

  const emailHtml = await render(ScrapeCompletionEmail(testData));

  return (
    <div style={{ padding: "20px", backgroundColor: "#f0f0f0" }}>
      <h1 style={{ marginBottom: "20px" }}>Email Preview: Scrape Completion</h1>
      <div style={{ border: "2px solid #ccc", borderRadius: "8px", overflow: "hidden", backgroundColor: "white" }}>
        <iframe
          srcDoc={emailHtml}
          style={{ width: "100%", minHeight: "500px", border: "none" }}
          title="Email Preview"
        />
      </div>
    </div>
  );
}
