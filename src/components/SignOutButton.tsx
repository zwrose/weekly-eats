"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="bg-red-600 text-white px-6 py-3 rounded-full font-medium hover:bg-red-700 hover:shadow-md cursor-pointer transition-all duration-200"
    >
      Sign Out
    </button>
  );
} 