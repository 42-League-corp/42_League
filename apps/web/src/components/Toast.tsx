import { useFlash } from '../hooks/useFlash';

export function Toast() {
  const { flash, clear } = useFlash();
  if (!flash.message) return null;
  const isError = flash.kind === 'error';
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div
        className={
          'flex items-center gap-2 px-4 py-2.5 rounded shadow-2xl border max-w-[90vw] sm:max-w-md text-sm ' +
          (isError
            ? 'bg-red/10 border-red text-[#ff8095]'
            : 'bg-bg-1 border-teal text-text')
        }
        onClick={clear}
        role="status"
      >
        {flash.message}
      </div>
    </div>
  );
}
