"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ShoppingBag, Phone, CalendarDays, Search, CreditCard, Truck, ShoppingCart, Box, MapPin, CheckCircle, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Chart from "react-apexcharts" // 💡 CHART IMPORT RE-ADDED

// --- Interface Definitions (Kept the same) ---
interface OrderItemJson {
    id: string
    product_id: string
    quantity: number
    price_at_purchase: number
    created_at: string
}

interface ProductDetailsForOrder {
    id: string
    product_name: string
    product_photo_urls: string[]
    company_id: string
}

interface OrderItemWithProduct extends OrderItemJson {
    products: ProductDetailsForOrder | null
}

interface Order {
    id: string
    total_amount: number
    status: string
    purchase_time: string
    customer_name: string
    primary_phone: string
    secondary_phone: string | null
    country: string
    state: string
    city: string
    pincode: string
    area: string | null
    street: string | null
    house_number: string | null
    order_items: OrderItemJson[]
    resolved_order_items?: OrderItemWithProduct[]
}

// Timeline steps for new design
const proTimelineSteps = [
    { label: "Order Confirmed", icon: ShoppingCart, status: "confirmed" },
    { label: "Payment Accepted", icon: CreditCard, status: "payment_accepted" },
    { label: "Order is Being Prepared", icon: Box, status: "preparing" },
    { label: "Order Has Been Shipped", icon: Truck, status: "shipped" },
    { label: "Order Successfully Delivered", icon: MapPin, status: "delivered" },
]
const statusOrder = ["confirmed", "payment_accepted", "preparing", "shipped", "delivered"]

// --- New Component: Update Status Modal ---
interface UpdateStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentOrder: Order;
    onUpdate: (orderId: string, newStatus: string) => void;
    isLoading: boolean;
}

const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({ isOpen, onClose, currentOrder, onUpdate, isLoading }) => {
    const currentStatusIndex = statusOrder.indexOf(currentOrder.status);

    // Filter statuses to only show statuses *after* the current one
    const availableSteps = proTimelineSteps.filter((step) => statusOrder.indexOf(step.status) > currentStatusIndex);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Status for Order #{currentOrder.id.substring(0, 8)}</DialogTitle>
                    <DialogDescription className="text-sm">
                        Current Status: <Badge className={getStatusBadgeClass(currentOrder.status)}>{currentOrder.status.charAt(0).toUpperCase() + currentOrder.status.slice(1)}</Badge>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-3 pt-4">
                    {availableSteps.length > 0 ? (
                        availableSteps.map((step) => (
                            <Button
                                key={step.status}
                                onClick={() => onUpdate(currentOrder.id, step.status)}
                                disabled={isLoading}
                                className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white transition-all"
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <step.icon className="mr-2 h-4 w-4" />}
                                Set to: {step.label}
                            </Button>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-4">This order is already marked as Delivered.</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
// --- End New Component ---

// --- Helper Functions ---
const getStatusBadgeClass = (status: string) => {
    switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-700";
        case "confirmed": return "bg-blue-100 text-blue-700";
        case "payment_accepted": return "bg-green-100 text-green-700";
        case "preparing": return "bg-yellow-100 text-yellow-700";
        case "shipped": return "bg-purple-100 text-purple-700";
        case "delivered": return "bg-green-100 text-green-700";
        case "cancelled": return "bg-red-100 text-red-700";
        default: return "bg-gray-100 text-gray-700";
    }
};

export default function CompanyMyOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [isUpdating, setIsUpdating] = useState(false) // State for updating status
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const router = useRouter()
    const { toast } = useToast()

    const fetchCompanyOrders = useCallback(async () => {
        setLoading(true)
        setError(null)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
            toast({ title: "Authentication Required", description: "Please log in to view your company's orders.", variant: "destructive", })
            router.push("/login")
            return
        }

        const userId = session.user.id

        // 1. Get the company_id for the logged-in user
        const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("id")
            .eq("user_id", userId)
            .single()

        if (companyError || !companyData) {
            setError("Company record not found for this user.")
            setLoading(false)
            return
        }
        const companyId = companyData.id

        // 2. Fetch all product_ids belonging to this company
        const { data: companyProducts, error: productsError } = await supabase
            .from("products")
            .select("id, company_id")
            .eq("company_id", companyId)

        if (productsError) {
            console.error("Error fetching company products:", productsError)
            setError("Failed to load company products for order filtering.")
            setLoading(false)
            return
        }

        const companyProductIds = new Set(companyProducts?.map((p) => p.id))

        if (companyProductIds.size === 0) {
            setOrders([])
            setLoading(false)
            return
        }

        // 3. Fetch all orders
        const { data: allOrdersData, error: allOrdersError } = await supabase
            .from("orders")
            .select(
                `
                id, total_amount, status, purchase_time, customer_name, primary_phone, secondary_phone, country, state, city, pincode, area, street, house_number, order_items
                `,
            )
            .order("purchase_time", { ascending: false })

        if (allOrdersError) {
            console.error("Error fetching all orders:", allOrdersError)
            setError("Failed to load orders. Please try again.")
            setOrders([])
            setLoading(false)
            return
        }

        // Filter orders to include only those that contain products from this company
        const filteredCompanyOrders =
            allOrdersData?.filter((order) =>
                order.order_items.some((item: OrderItemJson) => companyProductIds.has(item.product_id)),
            ) || []

        if (filteredCompanyOrders.length === 0) {
            setOrders([])
            setLoading(false)
            return
        }

        // Extract all unique product_ids from the filtered company orders' order_items
        const productIdsInCompanyOrders = new Set<string>()
        filteredCompanyOrders.forEach((order) => {
            if (Array.isArray(order.order_items)) {
                order.order_items.forEach((item: OrderItemJson) => {
                    productIdsInCompanyOrders.add(item.product_id)
                })
            }
        })

        const productsMap = new Map<string, ProductDetailsForOrder>()
        if (productIdsInCompanyOrders.size > 0) {
            // Fetch details for all unique products in these orders in one go
            const { data: productsDetailsData, error: productsDetailsError } = await supabase
                .from("products")
                .select("id, product_name, product_photo_urls, company_id")
                .in("id", Array.from(productIdsInCompanyOrders))

            if (productsDetailsError) {
                console.error("Error fetching product details for orders:", productsDetailsError)
            } else if (productsDetailsData) {
                productsDetailsData.forEach((product) => {
                    productsMap.set(product.id, product)
                })
            }
        }

        // Map product details back to each order's items and filter to show only company's products
        const resolvedOrders: Order[] = filteredCompanyOrders.map((order) => {
            const resolvedItems: OrderItemWithProduct[] = Array.isArray(order.order_items)
                ? order.order_items
                    .filter((item: OrderItemJson) => companyProductIds.has(item.product_id)) // Filter here to show only company's products
                    .map((item: OrderItemJson) => ({
                        ...item,
                        products: productsMap.get(item.product_id) || null,
                    }))
                : []
            return {
                ...order,
                resolved_order_items: resolvedItems,
            }
        })

        setOrders(resolvedOrders)
        setLoading(false)
    }, [router, toast])

    useEffect(() => {
        fetchCompanyOrders()

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) { router.push("/login") } else { fetchCompanyOrders() }
        })

        // Real-time listener for orders table to update status instantly
        const orderChannel = supabase.channel('order_status_updates').on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload) => {
                // Manually update the state with the new status without a full re-fetch
                setOrders(prevOrders => prevOrders.map(order => 
                    order.id === payload.new.id ? { ...order, status: payload.new.status as string } : order
                ));
            }
        ).subscribe();

        return () => {
            authListener.subscription.unsubscribe();
            supabase.removeChannel(orderChannel);
        }
    }, [fetchCompanyOrders, router])

    const handleStatusUpdate = async (orderId: string, newStatus: string) => {
        setIsUpdating(true);
        try {
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (updateError) throw updateError;

            toast({ title: "Status Updated!", description: `Order ${orderId.substring(0, 8)} status set to ${newStatus}.`, variant: "default" });
            setModalOpen(false);
            // The real-time listener will update the state, but we can optimistically update too.
            setOrders(prevOrders => prevOrders.map(order => 
                order.id === orderId ? { ...order, status: newStatus } : order
            ));
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: "Update Failed", description: "Could not update order status.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };


    const filteredOrders = orders.filter((order) => {
        const matchesSearchTerm =
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.primary_phone.includes(searchTerm) ||
            order.resolved_order_items?.some((item) =>
                item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        return matchesSearchTerm
    })

    // 💡 START: Logic for Pie Chart and Status Cards (taken from old code)
    // Calculate order status counts
    const orderStatusCounts = filteredOrders.reduce(
        (acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1
            return acc
        },
        {} as Record<string, number>,
    )

    // Pie chart data for order status summary
    const statusLabels = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"]
    const statusColors = ["#fbbf24", "#3b82f6", "#a78bfa", "#22c55e", "#ef4444"]
    const statusCounts = [
        orderStatusCounts["pending"] || 0,
        orderStatusCounts["confirmed"] || 0,
        orderStatusCounts["shipped"] || 0,
        orderStatusCounts["delivered"] || 0,
        orderStatusCounts["cancelled"] || 0,
    ]
    // 💡 END: Logic for Pie Chart and Status Cards (taken from old code)

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    <span className="ml-3 text-lg text-green-700">Loading your company's orders...</span>
                </main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col min-h-screen">
                <main className="flex-grow container mx-auto px-4 py-8">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="space-y-10 bg-gradient-to-br from-pink-50 via-white to-pink-100 min-h-screen pb-10">
            {/* Professional Top Navbar */}
            <nav className="w-full h-16 px-6 flex items-center bg-gradient-to-r from-pink-100 via-pink-50 to-pink-200 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
                <div className="flex items-center gap-3">
                    <ShoppingBag className="h-7 w-7 text-pink-500" />
                    <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">My Company Orders</span>
                </div>
            </nav>
            <div className="container mx-auto px-4">
                <div className="relative mb-8 flex flex-col items-center">
                    <div className="w-full max-w-xl">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 w-5 h-5" />
                            <Input
                                type="text"
                                placeholder="Search orders by ID, product name, or customer name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-3 border-0 rounded-xl shadow-lg bg-white/80 focus:ring-2 focus:ring-green-400 focus:border-green-400 text-lg"
                            />
                        </div>
                    </div>
                    {/* 💡 START: Order Status Summary Pie Chart (Re-added) */}
                    <div className="w-full flex flex-col items-center mt-8">
                        <div className="mb-4">
                            {/* @ts-ignore: react-apexcharts has no types */}
                            <Chart
                                options={{
                                    chart: { type: "pie", toolbar: { show: false } },
                                    labels: statusLabels,
                                    colors: statusColors,
                                    legend: { position: "bottom" },
                                }}
                                series={statusCounts}
                                type="pie"
                                width={320}
                            />
                        </div>
                        <div className="flex flex-wrap gap-4 justify-center">
                            {statusLabels.map((label, idx) => (
                                <div
                                    key={label}
                                    className={`px-4 py-2 rounded-xl font-semibold shadow-md text-white text-sm hover:scale-105 transition-transform duration-200`}
                                    style={{ background: statusColors[idx] }}
                                >
                                    {label}: {statusCounts[idx]}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* 💡 END: Order Status Summary Pie Chart (Re-added) */}
                </div>
                {/* Order Cards */}
                <div className="space-y-8">
                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <ShoppingBag className="w-20 h-20 mb-4 text-gray-300" />
                            <p className="text-xl font-medium mb-2">No orders found for your products.</p>
                            <p className="text-md mb-6">Once customers purchase your products, their orders will appear here.</p>
                            <Button asChild className="bg-gradient-to-r from-green-500 via-blue-600 to-green-400 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:scale-105 transition-transform duration-200">
                                <Link href="/company/dashboard/add-product">Add Products to Sell</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {filteredOrders.map((order, idx) => (
                                <Card
                                    key={order.id}
                                    className={`shadow-xl border-0 rounded-2xl bg-gradient-to-br ${[
                                        "from-pink-100 via-pink-50 to-pink-200", "from-blue-100 via-blue-50 to-blue-200",
                                        "from-green-100 via-green-50 to-green-200", "from-yellow-100 via-yellow-50 to-yellow-200",
                                        "from-purple-100 via-purple-50 to-purple-200", "from-orange-100 via-orange-50 to-orange-200",
                                    ][idx % 6]} hover:scale-105 transition-transform duration-200`}
                                >
                                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                                        <div>
                                            <CardTitle className="text-xl font-bold text-gray-900">Order #{order.id.substring(0, 8)}</CardTitle>
                                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                                <CalendarDays className="w-4 h-4" />
                                                {new Date(order.purchase_time).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge className={`px-3 py-1 text-sm font-medium ${getStatusBadgeClass(order.status)}`}>
                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </Badge>
                                            
                                            {/* 🎯 UPDATE STATUS BUTTON */}
                                            {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                <Button
                                                    onClick={() => { setSelectedOrder(order); setModalOpen(true); }}
                                                    disabled={isUpdating}
                                                    variant="default"
                                                    size="sm"
                                                    className="bg-purple-600 hover:bg-purple-700 transition-colors"
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    Update Status
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Order Tracking Timeline - Reusing the complex visual timeline */}
                                        <div className="w-full flex flex-col items-center mb-4">
                                            <div className="flex items-center w-full justify-between px-2 overflow-x-auto pb-2">
                                                {proTimelineSteps.map((step, stepIdx) => {
                                                    const currentStatusIdx = statusOrder.indexOf(order.status)
                                                    const thisStepIdx = statusOrder.indexOf(step.status)
                                                    const isActive = thisStepIdx === currentStatusIdx
                                                    const isCompleted = thisStepIdx < currentStatusIdx
                                                    const isLast = stepIdx === proTimelineSteps.length - 1
                                                    return (
                                                        <div key={step.label} className="flex flex-col items-center flex-1 min-w-[15%] max-w-[20%] xl:min-w-[100px] xl:max-w-none">
                                                            <div className="relative flex flex-col items-center">
                                                                <div className="z-10">
                                                                    <step.icon
                                                                        className={`h-8 w-8 p-1 rounded-full border-2 shadow-md ${
                                                                            isActive
                                                                                ? "bg-gradient-to-r from-green-400 to-blue-500 text-white border-blue-500"
                                                                                : isCompleted
                                                                                    ? "bg-green-400 text-white border-green-500"
                                                                                    : "bg-gray-200 text-gray-400 border-gray-300"
                                                                        }`}
                                                                    />
                                                                </div>
                                                                {/* Connecting line */}
                                                                {!isLast && (
                                                                    <div
                                                                        className={`absolute top-1/2 left-full h-[6px] -translate-y-1/2 z-0 w-full md:w-[100px] sm:w-[100px] xl:w-[200px] ${ 
                                                                            isCompleted
                                                                                ? "bg-green-400"
                                                                                : isActive
                                                                                    ? "bg-blue-400"
                                                                                    : "bg-gray-200"
                                                                        }`}
                                                                        style={{ height: "6px" }}
                                                                    ></div>
                                                                )}
                                                            </div>
                                                            <span className={`mt-2 text-xs font-semibold text-center ${
                                                                isActive
                                                                    ? "text-blue-600"
                                                                    : isCompleted
                                                                        ? "text-green-600"
                                                                        : "text-gray-400"
                                                            }`} style={{ minWidth: 80 }}>{step.label}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        {/* End Timeline */}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Order Summary */}
                                            <div className={`space-y-2 bg-gradient-to-br from-pink-100 via-pink-50 to-pink-200 rounded-xl shadow-md p-4 transition-transform duration-200 hover:scale-105 hover:shadow-xl`}>
                                                <h3 className="font-semibold text-gray-800">Order Summary</h3>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Total Items from your company:</span>
                                                    <span>{order.resolved_order_items?.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Total Amount for your products:</span>
                                                    <span className="font-bold text-gray-900">
                                                        ₹{order.resolved_order_items?.reduce((sum, item) => sum + item.price_at_purchase * item.quantity, 0)?.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Shipping Address */}
                                            <div className={`space-y-2 bg-gradient-to-br from-pink-100 via-pink-50 to-pink-200 rounded-xl shadow-md p-4 transition-transform duration-200 hover:scale-105 hover:shadow-xl`}>
                                                <h3 className="font-semibold text-gray-800">Shipping Address</h3>
                                                <p className="text-sm text-gray-600">
                                                    {order.customer_name}<br />
                                                    {order.house_number}, {order.street}<br />
                                                    {order.area}, {order.city} - {order.pincode}<br />
                                                    {order.state}, {order.country}
                                                </p>
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <Phone className="w-4 h-4" /> {order.primary_phone}
                                                    {order.secondary_phone && `, ${order.secondary_phone}`}
                                                </p>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Ordered Products (only from this company) */}
                                        <h3 className="font-semibold text-gray-800">Your Products in this Order</h3>
                                        <div className={`space-y-3 bg-gradient-to-br from-pink-100 via-pink-50 to-pink-200 rounded-xl shadow-md p-4 transition-transform duration-200 hover:scale-105 hover:shadow-xl`}>
                                            {order.resolved_order_items?.length === 0 ? (
                                                <p className="text-sm text-gray-500">No products from your company in this order.</p>
                                            ) : (
                                                order.resolved_order_items?.map((item) => (
                                                    <div key={item.id} className="flex items-center gap-4">
                                                        <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
                                                            <Image src={item.products?.product_photo_urls?.[0] || "/placeholder.svg"} alt={item.products?.product_name || "Product Image"} fill sizes="64px" className="object-cover" />
                                                        </div>
                                                        <div className="flex-grow">
                                                            <Link href={`/product/${item.product_id}`} className="text-md font-medium text-gray-900 hover:text-green-600 line-clamp-1">{item.products?.product_name || "Unknown Product"}</Link>
                                                            <p className="text-sm text-gray-600">₹{item.price_at_purchase.toFixed(2)} x {item.quantity}</p>
                                                        </div>
                                                        <span className="font-semibold text-gray-900">₹{(item.price_at_purchase * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))
                                            )}
                                            <div className="flex justify-end pt-4">
                                                {order.resolved_order_items && order.resolved_order_items.length > 0 && (
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        className="bg-gradient-to-r from-pink-500 to-purple-400 text-white font-semibold border-0 rounded-lg shadow-md hover:scale-105 hover:from-purple-400 hover:to-pink-500 transition-transform duration-200"
                                                    >
                                                        <Link href={`/product/${order.resolved_order_items[0].product_id}`}>
                                                            View Products in Order
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* 🎯 UPDATE STATUS MODAL */}
            {selectedOrder && (
                <UpdateStatusModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    currentOrder={selectedOrder}
                    onUpdate={handleStatusUpdate}
                    isLoading={isUpdating}
                />
            )}
        </div>
    );
}