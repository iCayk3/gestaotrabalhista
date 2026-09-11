import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'SOL · Gestão trabalhista',description:'Cadastro de colaboradores, lançamentos mensais e resultados calculados com histórico e acesso individual.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
