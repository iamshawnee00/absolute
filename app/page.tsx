import { redirect } from 'next/navigation';

export default function Home() {
  // Automatically redirect users from the root URL ("/") to the claims dashboard ("/claims")
  redirect('/claims');
}