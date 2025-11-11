"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Header } from "@/components/Header";
import { CreatePollForm } from "@/components/CreatePollForm";
import { PollList } from "@/components/PollList";
import { useFhevmContext } from "@/hooks/useFhevmProvider";
import { MultiChoiceVotingABI } from "@/abi/MultiChoiceVotingABI";
import { getContractAddress } from "@/config/contract";

function StatCard({
  label,
  value,
  helper,
  accentClass,
}: {
  label: string;
  value: string;
  helper: string;
  accentClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-lg backdrop-blur">
      <div className={`absolute inset-0 ${accentClass} opacity-40`} />
      <div className="relative">
        <p className="text-xs uppercase tracking-widest text-slate-300/80">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
        <p className="mt-2 text-xs text-slate-300">{helper}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { isConnected, chain } = useAccount();
  const { isReady: fhevmReady, error: fhevmError } = useFhevmContext();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!chain) {
      setContractAddress(null);
      return;
    }

    try {
      const address = getContractAddress(chain.id) as `0x${string}`;
      setContractAddress(address);
    } catch (err) {
      console.warn("[Home] Unsupported chain id:", chain.id, err);
      setContractAddress(null);
    }
  }, [chain]);

  const { data: pollCountData } = useReadContract({
    address: contractAddress ?? undefined,
    abi: MultiChoiceVotingABI,
    functionName: "getPollCount",
    query: {
      enabled: Boolean(contractAddress && isConnected),
      refetchInterval: 10000,
    },
  });

  const pollCount = pollCountData !== undefined ? Number(pollCountData) : null;
  const activeNetworkLabel = isConnected ? chain?.name ?? "Unknown network" : "Disconnected";

  const fhevmStatus = useMemo(() => {
    if (fhevmError) {
      return {
        label: "Initialisation failed",
        helper: fhevmError.message || "Unknown error occurred",
        accent: "bg-gradient-to-br from-red-500/40 via-red-500/10 to-transparent",
      };
    }
    if (fhevmReady) {
      return {
        label: "Ready",
        helper: "Encryption toolkit is ready for voting and decryption",
        accent: "bg-gradient-to-br from-emerald-500/40 via-emerald-500/10 to-transparent",
      };
    }
    return {
      label: "Initialising",
      helper: "This usually takes up to 10 seconds. Keep your wallet connected.",
      accent: "bg-gradient-to-br from-sky-500/40 via-sky-500/10 to-transparent",
    };
  }, [fhevmReady, fhevmError]);

  const stats = useMemo(
    () => [
      {
        label: "Polls on chain",
        value: pollCount !== null ? pollCount.toString() : "—",
        helper: contractAddress ? "Live data from the connected network" : "Connect to a supported network to view data",
        accent: "bg-gradient-to-br from-emerald-400/40 via-emerald-400/10 to-transparent",
      },
      {
        label: "Active network",
        value: activeNetworkLabel,
        helper: contractAddress ? contractAddress : "Connect to Localhost or Sepolia",
        accent: "bg-gradient-to-br from-indigo-400/40 via-indigo-400/10 to-transparent",
      },
      {
        label: "FHE engine",
        value: fhevmStatus.label,
        helper: fhevmStatus.helper,
        accent: fhevmStatus.accent,
      },
    ],
    [pollCount, activeNetworkLabel, contractAddress, fhevmStatus]
  );

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">Loading interface...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),rgba(15,23,42,0.1))]" />

      <Header />

      <main className="relative z-10">
        <section className="container mx-auto px-4 py-12 lg:py-16">
          {/* Hero Section */}
          <div className="mx-auto max-w-5xl text-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.35),transparent_60%)]" />
              <div className="relative space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.4em] text-slate-200/90">
                  FHE POWERED VOTING
                </span>
                <h2 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
                  Secure, encrypted and verifiable on-chain voting
                </h2>
                <p className="mx-auto max-w-3xl text-base text-slate-200 sm:text-lg">
                  Fully Homomorphic Encryption protects every ballot end-to-end. Votes stay encrypted until you authorise decryption or the Zama oracle responds. On localhost you can auto-decrypt with one click.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 px-8 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    {showCreateForm ? "Back to poll list" : "Create new poll"}
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </button>
                  <span className="text-sm text-slate-300">
                    {contractAddress ? `Contract: ${contractAddress}` : "Please connect to a supported network"}
                  </span>
                </div>
              </div>

              <div className="relative mt-10 grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <StatCard
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    helper={stat.helper}
                    accentClass={stat.accent}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="mt-12 lg:mt-16">
            {showCreateForm ? (
              <div className="mx-auto max-w-3xl">
                <CreatePollForm onSuccess={handleCreateSuccess} />
              </div>
            ) : (
              <PollList refreshTrigger={refreshTrigger} />
            )}
          </div>

          {/* Features Section */}
          {!showCreateForm && (
            <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  icon: "🔒",
                  title: "End-to-end privacy",
                  description: "Ballots stay encrypted throughout their lifecycle and are only decrypted with explicit authorisation.",
                },
                {
                  icon: "⛓️",
                  title: "Transparent and auditable",
                  description: "Smart contracts record every action on-chain, ensuring tamper-proof transparency.",
                },
                {
                  icon: "⚡",
                  title: "One-click decryption",
                  description: "Local development supports automatic decryption from the UI to speed up iteration.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:border-white/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  <div className="relative space-y-3 text-left">
                    <span className="text-3xl">{feature.icon}</span>
                    <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
