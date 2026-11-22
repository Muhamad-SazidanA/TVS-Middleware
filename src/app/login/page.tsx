"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Lock, Mail, ArrowRight, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/matching";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Silakan isi email dan password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!res || res.error) {
        setErrorMessage("Email atau password tidak sesuai.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("Login submission error:", err);
      setErrorMessage("Terjadi kendala saat login. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  const handleQuickFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("password123");
    setErrorMessage("");
  };

  return (
    <div className="w-full max-w-[360px] bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Slim Clean Header */}
      <div className="pt-7 pb-5 px-6 text-center border-b border-slate-100">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">Docmatch</h1>
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
          PT. United Steel Center Indonesia
        </p>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200/80 rounded-lg text-rose-800 text-[11px] leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@docmatch.id"
                autoComplete="email"
                required
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi akun"
                autoComplete="current-password"
                required
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Minimalist Quick-Fill Testing Helper */}
        <div className="pt-3.5 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Pilih Akun Cepat (Testing)
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill("usera@docmatch.id")}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-700">User A</div>
              <div className="text-[9.5px] text-slate-400">Staff</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("userb@docmatch.id")}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-700">User B</div>
              <div className="text-[9.5px] text-slate-400">Staff</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("userc@docmatch.id")}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-700">User C</div>
              <div className="text-[9.5px] text-slate-400">Staff</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("admin@docmatch.id")}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-semibold text-slate-700">Admin</div>
              <div className="text-[9.5px] text-slate-400">Approver</div>
            </button>
          </div>
          <p className="text-[9.5px] text-slate-400 mt-2 text-center">
            Password: <span className="font-mono text-slate-500">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-[360px] bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            Memuat...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
