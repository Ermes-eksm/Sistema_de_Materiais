import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Materiais | Obra 128 · Salg Resort',description:'Estoque, movimentações e devoluções da Obra 128 — Salg Resort.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
