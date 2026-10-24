import { redirect } from "next/navigation";
import { buildReport } from "@/lib/report";
import { currentUser } from "@/lib/session";
import { AnalyzerView } from "./view";

export default async function Analyzer() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  const report = await buildReport();
  return <AnalyzerView report={report} />;
}
