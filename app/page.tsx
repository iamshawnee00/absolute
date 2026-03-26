import { redirect } from 'next/navigation';

export default function Home() {
  // Automatically redirect users from the root URL ("/") to the main app hub ("/dashboard")
  redirect('/dashboard');
}