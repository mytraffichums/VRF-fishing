import { FishingGameCanvas } from "@/components/fishing/FishingGameCanvas";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <main className="container mx-auto px-4 py-6">
        <FishingGameCanvas />

        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Powered by Pyth Entropy on Monad Testnet</p>
        </div>
      </main>
    </div>
  );
}
