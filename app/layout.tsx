import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Almoxarifado SSMA | Obra 128 · Salg Resort',description:'Gestão de EPIs, estoque, entregas e devoluções da Obra 128 — Salg Resort.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
