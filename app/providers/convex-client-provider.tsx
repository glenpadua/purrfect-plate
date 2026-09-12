"use client"

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs"
import { ConvexReactClient, Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { usePathname } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { Cat, Loader2 } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"

function LibraryAccess({ children }: { children: ReactNode }) {
  const library = useQuery(api.libraries.current)
  const join = useMutation(api.libraries.join)
  const [error, setError] = useState("")
  useEffect(() => { if (library === null) void join({}).catch(e => setError(e instanceof Error ? e.message : "This account is not invited to this library.")) }, [library, join])
  if (library === undefined || (library === null && !error)) return <Loading />
  if (!library) return <div className="mx-auto max-w-lg px-6 py-24 text-center"><Cat className="mx-auto mb-6 size-12 text-primary" /><h1 className="text-3xl">This kitchen is private</h1><p className="my-5 text-muted-foreground">Sign in with the email invited to Glen and Millusha’s library.</p><UserButton /><p className="mt-6 text-sm text-muted-foreground" role="alert">{error.includes("verified") ? "Please verify your email address in your account settings." : "Your account does not have library access."}</p></div>
  return <>{children}<div className="fixed right-16 top-4 z-50 rounded-full bg-background p-1 shadow-sm"><UserButton /></div></>
}
function Loading() { return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Opening your kitchen…</div> }

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [client] = useState(() => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!))
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) return <>{children}</>
  return <ConvexProviderWithClerk client={client} useAuth={useAuth}>
    <AuthLoading><Loading /></AuthLoading>
    <Unauthenticated><main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center"><Cat className="mb-6 size-16 text-primary" /><p className="text-xs tracking-[0.2em] text-primary">PURRFECT PLATE</p><h1 className="my-5 text-5xl leading-tight">Good food.<br />Worth keeping.</h1><p className="mb-8 text-muted-foreground">Your recipes, saved links, and dinner inspiration. One cozy kitchen to share.</p><div className="flex gap-3"><SignInButton mode="redirect" withSignUp><Button>Sign in</Button></SignInButton><SignUpButton mode="redirect"><Button variant="outline">Create account</Button></SignUpButton></div><p className="mt-6 text-xs text-muted-foreground">A private recipe library for Glen and Millusha.</p></main></Unauthenticated>
    <Authenticated><LibraryAccess>{children}</LibraryAccess></Authenticated>
  </ConvexProviderWithClerk>
}
