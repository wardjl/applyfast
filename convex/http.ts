import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { streamJobScore } from "./jobScoringStream";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/job-scoring/stream",
  method: "POST",
  handler: streamJobScore,
});

export default http;
