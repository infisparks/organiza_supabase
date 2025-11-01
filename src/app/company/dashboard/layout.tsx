"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    PlusCircle,
    Settings,
    LogOut,
    Building,
    PanelLeftOpen,
    PanelLeftClose,
    Loader2,
    Menu, // 💡 NEW: Icon for the mobile menu button
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet" // 💡 SheetTrigger added back for the mobile button
import { useToast } from "@/hooks/use-toast"

interface CompanyInfo {
    company_name: string
    company_logo_url: string | null
}

export default function CompanyDashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { toast } = useToast()

    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
    const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(true)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false) // State for mobile sheet

    useEffect(() => {
        // Load sidebar state from local storage
        const savedState = localStorage.getItem("isSidebarCollapsed")
        if (savedState !== null) {
            setIsSidebarCollapsed(JSON.parse(savedState))
        }

        const fetchCompanyDetails = async () => {
            setLoadingCompanyInfo(true)
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession()

            if (sessionError || !session) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to access the company dashboard.",
                    variant: "destructive",
                })
                router.push("/login")
                return
            }

            const userId = session.user.id
            const { data, error } = await supabase
                .from("companies")
                .select("company_name, company_logo_url")
                .eq("user_id", userId)
                .single()

            if (error || !data) {
                console.error("Error fetching company info:", error)
                toast({
                    title: "Company Not Found",
                    description: "Could not load company details. Please ensure your company is registered and approved.",
                    variant: "destructive",
                })
                router.push("/") // Redirect to home or registration
            } else {
                setCompanyInfo(data)
            }
            setLoadingCompanyInfo(false)
        }

        fetchCompanyDetails()

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push("/login")
            } else {
                fetchCompanyDetails() // Re-fetch if session changes
            }
        })

        return () => {
            authListener.subscription.unsubscribe()
        }
    }, [router, toast])

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            toast({
                title: "Logout Error",
                description: error.message,
                variant: "destructive",
            })
        } else {
            toast({
                title: "Logged Out",
                description: "You have been successfully logged out.",
            })
            router.push("/login")
        }
    }

    const toggleSidebar = () => {
        setIsSidebarCollapsed((prev) => {
            const newState = !prev
            localStorage.setItem("isSidebarCollapsed", JSON.stringify(newState))
            return newState
        })
    }

    const navItems = [
        {
            name: "Dashboard",
            href: "/company/dashboard",
            icon: LayoutDashboard,
        },
        {
            name: "My Products",
            href: "/company/dashboard/my-products",
            icon: Package,
        },
        {
            name: "Add Product",
            href: "/company/dashboard/add-product",
            icon: PlusCircle,
        },
        {
            name: "My Orders",
            href: "/company/dashboard/my-orders",
            icon: ShoppingBag,
        },
        // {
        //     name: "Settings", // 💡 ADDED Settings back for completeness, matching the previous commented item
        //     href: "/company/dashboard/settings",
        //     icon: Settings,
        // },
    ]

    if (loadingCompanyInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <Loader2 className="h-10 w-10 animate-spin text-green-600" />
                <span className="ml-3 text-lg text-green-700">Loading company dashboard...</span>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Desktop Sidebar (fixed position, hidden on mobile) */}
            <aside
                className={`hidden lg:flex fixed inset-y-0 left-0 z-20 flex-col border-r border-gray-200 bg-white shadow-sm py-6 transition-all duration-300 ease-in-out ${
                    isSidebarCollapsed ? "w-20 items-center" : "w-64"
                }`}
            >
                <div
                    className={`flex items-center px-4 mb-8 ${isSidebarCollapsed ? "justify-center" : "justify-between"} w-full`}
                >
                    {!isSidebarCollapsed && (
                        <Link href="/company/dashboard" className="flex items-center gap-2">
                            {companyInfo?.company_logo_url ? (
                                <img
                                    src={companyInfo.company_logo_url || "/placeholder.svg"}
                                    alt={`${companyInfo.company_name} Logo`}
                                    className="h-8 w-8 rounded-full object-cover"
                                />
                            ) : (
                                <Building className="h-8 w-8 text-green-600" />
                            )}
                            <span className="text-xl font-bold text-gray-900">{companyInfo?.company_name || "Company"}</span>
                        </Link>
                    )}
                    {/* DESKTOP TOGGLE BUTTON */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="h-10 w-10"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </Button>
                </div>

                <nav className="flex-1 px-2 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                                pathname === item.href
                                    ? "bg-green-100 text-green-700"
                                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            } ${isSidebarCollapsed ? "justify-center" : ""}`}
                            aria-current={pathname === item.href ? "page" : undefined}
                        >
                            <item.icon className={`h-5 w-5 ${isSidebarCollapsed ? "" : "flex-shrink-0"}`} />
                            {!isSidebarCollapsed && <span>{item.name}</span>}
                            {isSidebarCollapsed && <span className="sr-only">{item.name}</span>}
                        </Link>
                    ))}
                </nav>

                <div className={`px-4 mt-auto ${isSidebarCollapsed ? "flex justify-center" : ""}`}>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 ${
                            isSidebarCollapsed ? "justify-center" : ""
                        }`}
                        onClick={handleLogout}
                    >
                        <LogOut className={`h-5 w-5 ${isSidebarCollapsed ? "" : "mr-3"}`} />
                        {!isSidebarCollapsed && <span>Logout</span>}
                        {isSidebarCollapsed && <span className="sr-only">Logout</span>}
                    </Button>
                </div>
            </aside>

            {/* Mobile Sheet (Sidebar) - Opened by the header button */}
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                {/* SheetTrigger is no longer needed here as it's moved to the header. */}
                <SheetContent side="left" className="p-0 w-64">
                    <div className="flex flex-col h-full bg-white border-r border-gray-200 py-6">
                        <div className="flex items-center px-4 mb-8">
                            <Link href="/company/dashboard" className="flex items-center gap-2">
                                {companyInfo?.company_logo_url ? (
                                    <img
                                        src={companyInfo.company_logo_url || "/placeholder.svg"}
                                        alt={`${companyInfo.company_name} Logo`}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <Building className="h-8 w-8 text-green-600" />
                                )}
                                <span className="text-xl font-bold text-gray-900">{companyInfo?.company_name || "Company"}</span>
                            </Link>
                        </div>
                        <nav className="flex-1 px-2 space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                                        pathname === item.href
                                            ? "bg-green-100 text-green-700"
                                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    }`}
                                    aria-current={pathname === item.href ? "page" : undefined}
                                    onClick={() => setIsMobileSheetOpen(false)} // Close sheet on navigation
                                >
                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                    <span>{item.name}</span>
                                </Link>
                            ))}
                        </nav>
                        <div className="px-4 mt-auto">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={handleLogout}
                            >
                                <LogOut className="h-5 w-5 mr-3" />
                                <span>Logout</span>
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Main content wrapper, which accounts for sidebar width */}
            <div
                className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}
            >
                {/* 💡 NEW MOBILE HEADER */}
                <header className="sticky top-0 z-10 lg:hidden flex items-center justify-between h-16 px-4 border-b border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2">
                        {companyInfo?.company_logo_url ? (
                            <img
                                src={companyInfo.company_logo_url || "/placeholder.svg"}
                                alt={`${companyInfo.company_name} Logo`}
                                className="h-8 w-8 rounded-full object-cover"
                            />
                        ) : (
                            <Building className="h-8 w-8 text-green-600" />
                        )}
                        <span className="text-xl font-bold text-gray-900">{companyInfo?.company_name || "Dashboard"}</span>
                    </div>
                    {/* MOBILE TOGGLE BUTTON */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMobileSheetOpen(true)}
                        aria-label="Open sidebar menu"
                    >
                        <Menu className="h-6 w-6" />
                    </Button>
                </header>
                {/* End NEW MOBILE HEADER */}

                {/* Main content area */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    )
}