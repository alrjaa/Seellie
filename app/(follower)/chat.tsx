import { Redirect } from 'expo-router';

/** Legacy chat route — inbox lives under messages. */
export default function ChatRedirect() {
  return <Redirect href="/(follower)/messages" />;
}
