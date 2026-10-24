export default function Terms() {
  return (
    <div className="card mx-auto max-w-2xl space-y-3 text-sm">
      <h1 className="text-xl font-bold">Terms of Service (fictional)</h1>
      <p>The “Find a Doctor” directory is provided for patients seeking care. You may not use automated means (bots, scrapers, crawlers) to collect, copy or index its contents. See <a href="/robots.txt" className="underline">robots.txt</a>.</p>
      <p>The staff portal and the <code>/api/</code> endpoints are not public. Access is limited to authorized personnel for assigned duties. All access is logged. Unauthorized access is prohibited and may violate the Computer Fraud and Abuse Act, 18 U.S.C. § 1030, and may be the subject of a civil action under § 1030(g).</p>
      <p className="text-xs text-neutral-500">Public scraping sits in a legal gray zone after hiQ Labs v. LinkedIn (9th Cir. 2022); these Terms and a cease-and-desist letter are the primary remedies for the public page.</p>
    </div>
  );
}
