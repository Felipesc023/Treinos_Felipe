/** Mostrado na hora ao navegar enquanto a página busca os dados: o toque responde mesmo com a rede lenta. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4 pt-2" aria-busy aria-label="Carregando">
      <div className="h-9 w-40 rounded-xl bg-soft" />
      <div className="h-28 rounded-[18px] bg-soft" />
      <div className="h-44 rounded-[18px] bg-soft" />
      <div className="h-20 rounded-[18px] bg-soft" />
    </div>
  );
}
