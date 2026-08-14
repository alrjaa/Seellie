import { Redirect } from 'expo-router';

/** FIX-08 F08-F01: analysis creation lives on Unique — avoid duplicate flow. */
export default function AnalysisCreateRedirect() {
  return <Redirect href="/unique" />;
}
