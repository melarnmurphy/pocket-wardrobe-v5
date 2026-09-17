import { ImagePlus } from "lucide-react";

export default function ChoosePhotosLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1240px] px-5 py-8 pb-16 lg:px-10"
      aria-busy="true"
      aria-label="Opening photo upload"
    >
      <div className="lg:ml-[136px]">
        <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="mt-5 h-[48px] w-72 max-w-full animate-pulse bg-[rgba(17,17,17,0.07)]" />
      </div>
      <div className="mt-10 ml-0 flex min-h-[clamp(480px,68vh,740px)] items-center justify-center rounded-[4px] border border-dashed border-[rgba(30,26,23,.24)] lg:ml-[136px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <ImagePlus size={30} strokeWidth={1.25} className="text-[var(--stone)]" />
          <p className="text-[14px] text-[var(--slate)]">preparing your photo library…</p>
        </div>
      </div>
    </main>
  );
}
