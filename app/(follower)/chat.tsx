import { Redirect } from 'expo-router';

/** الدردشة أُلغيت — نكتفي بالساحات. */
export default function ChatRedirect() {
  return <Redirect href="/forums" />;
}
