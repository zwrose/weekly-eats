import React from 'react';
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import SignInButton from "../components/SignInButton";

export default async function Home() {
  const session = await getServerSession();

  // If user is signed in, redirect to /home
  if (session) {
    redirect("/home");
  }

  return (
    <div className="min-h-screen bg-black grid place-items-center p-8 pb-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center">
        <h1 className="text-3xl font-bold text-center text-white">Weekly Eats: Coming Soon</h1>
        
        <div className="text-center text-white max-w-md">
          <p className="text-lg mb-6">
            Plan your meals, discover new recipes, and never wonder what to cook again.
          </p>
          <p className="text-gray-300 mb-8">
            Sign in to get started.
          </p>
        </div>

        <SignInButton />
      </main>
    </div>
  );
}
