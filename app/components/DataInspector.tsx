"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function DataInspector() {
  const jobData = useQuery(api.dataInspection.inspectJobData);
  const fieldAnalysis = useQuery(api.dataInspection.analyzeJobDataFields);

  if (jobData === undefined || fieldAnalysis === undefined) {
    return <div className="p-4">Loading data inspection...</div>;
  }

  if (jobData.error) {
    return <div className="p-4 text-gray-600 dark:text-gray-400">Error: {jobData.error}</div>;
  }

  if (!jobData.scrape || !fieldAnalysis.fields || !jobData.sampleJobs) {
    return <div className="p-4 text-gray-600 dark:text-gray-400">Invalid data structure</div>;
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Data Inspector</h2>

      {/* Recent Scrape Info */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Recent Scrape</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Name:</strong> {jobData.scrape.name}</div>
          <div><strong>Status:</strong> {jobData.scrape.status}</div>
          <div><strong>Total Jobs:</strong> {jobData.scrape.totalJobs}</div>
          <div><strong>Created:</strong> {new Date(jobData.scrape.createdAt).toLocaleString()}</div>
        </div>
      </div>

      {/* Field Analysis */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Field Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Analyzing {fieldAnalysis.totalJobs} jobs from {fieldAnalysis.totalScrapes} scrapes
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Field</th>
                <th className="text-left p-2">Usage</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Sample Values</th>
              </tr>
            </thead>
            <tbody>
              {fieldAnalysis.fields.map((field, index) => (
                <tr key={index} className="border-b">
                  <td className="p-2 font-mono text-gray-600 dark:text-gray-400">{field.field}</td>
                  <td className="p-2">{field.usage}</td>
                  <td className="p-2">{field.type}</td>
                  <td className="p-2 max-w-xs">
                    {field.samples.map((sample: unknown, i: number) => (
                      <div key={i} className="truncate text-xs bg-gray-100 dark:bg-gray-700 p-1 mb-1 rounded">
                        {typeof sample === 'string' ? sample : JSON.stringify(sample)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Jobs */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Sample Jobs ({jobData.sampleCount})</h3>
        {jobData.sampleJobs.map((job, index) => (
          <div key={index} className="mb-4 p-3 border rounded">
            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div><strong>Title:</strong> {job.title}</div>
              <div><strong>Company:</strong> {job.company}</div>
              <div><strong>Location:</strong> {job.location || 'N/A'}</div>
              <div><strong>Salary:</strong> {job.salary || 'N/A'}</div>
            </div>
            <div className="text-xs">
              <strong>Raw Data Keys:</strong> {job.rawDataKeys.join(', ')}
            </div>
            {job.rawDataSample && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 transition-colors dark:text-gray-400 dark:hover:text-gray-200">View Raw Data Sample</summary>
                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 mt-1 rounded overflow-x-auto">
                  {job.rawDataSample}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}