"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Loader2, Package, DollarSign, ShoppingCart, Clock, ListChecks, AlertTriangle, ShoppingBag, ShoppingBasket } from "lucide-react" 
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Chart from "react-apexcharts"
import Image from "next/image" 

interface DashboardStats {
    companyName: string
    totalProducts: number
    totalSalesAmount: number
    totalOrders: number
    pendingOrders: number
    activeListings: number
    outOfStockProducts: number
    lowStockProducts: Array<{
        id: string
        product_name: string
        stock_quantity: number
        product_photo_urls: string[]
    }>
    allSellingProducts: Array<{ 
        product_id: string
        product_name: string
        units_sold: number
        revenue_generated: number
        product_photo_urls: string[]
    }>
    chartSalesData: number[]
    chartSalesLabels: string[] // Full day/date for tooltip
    chartXAxisLabels: string[] // Short day name for X-axis display
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    useEffect(() => {
        const fetchDashboardStats = async () => {
            setLoading(true)
            setError(null)

            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession()

            if (sessionError || !session) {
                setError("Authentication required.")
                setLoading(false)
                return
            }

            const userId = session.user.id

            // 1. Get company_id and company_name for the logged-in user
            const { data: companyData, error: companyError } = await supabase
                .from("companies")
                .select("id, company_name")
                .eq("user_id", userId)
                .single()

            if (companyError || !companyData) {
                setError("Company not found or not approved.")
                setLoading(false)
                return
            }
            const companyId = companyData.id
            const companyName = companyData.company_name

            // 2. Fetch products for this company
            const { data: productsData, error: productsError } = await supabase
                .from("products")
                .select("id, product_name, discount_price, original_price, stock_quantity, is_approved, product_photo_urls")
                .eq("company_id", companyId)

            if (productsError) {
                console.error("Error fetching products for dashboard:", productsError)
                setError("Failed to load product data.")
                setLoading(false)
                return
            }

            const totalProducts = productsData?.length || 0
            const activeListings = productsData?.filter((p) => p.is_approved).length || 0
            const outOfStockProducts = productsData?.filter((p) => p.stock_quantity === 0).length || 0
            
            // Low Stock threshold: 0 < stock < 10
            const lowStockProducts = productsData?.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10) || [] 

            const companyProductIds = new Set(productsData?.map((p) => p.id))
            const productDetailsMap = new Map(productsData?.map((p) => [p.id, p]))

            // 3. Fetch all orders and filter client-side for company-specific orders
            const { data: allOrdersData, error: ordersError } = await supabase
                .from("orders")
                .select("id, total_amount, status, order_items, purchase_time")

            if (ordersError) {
                console.error("Error fetching orders for dashboard:", ordersError)
                setError("Failed to load order data.")
                setLoading(false)
                return
            }

            let totalSalesAmount = 0
            let totalOrders = 0
            let pendingOrders = 0
            const productSales: { [key: string]: { units: number; revenue: number } } = {}
            
            // 4. Setup Sales Aggregation for Chart (Last 7 Days)
            const salesByDate = new Map<string, number>();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Initialize map with last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                salesByDate.set(date.toISOString().split('T')[0], 0);
            }


            if (allOrdersData) {
                allOrdersData.forEach((order) => {
                    let hasCompanyProductInOrder = false
                    let companySpecificOrderAmount = 0
                    
                    if (Array.isArray(order.order_items)) {
                        order.order_items.forEach((item: any) => {
                            if (companyProductIds.has(item.product_id)) {
                                hasCompanyProductInOrder = true
                                companySpecificOrderAmount += item.price_at_purchase * item.quantity

                                // Aggregate for all selling products
                                if (!productSales[item.product_id]) {
                                    productSales[item.product_id] = { units: 0, revenue: 0 }
                                }
                                productSales[item.product_id].units += item.quantity
                                productSales[item.product_id].revenue += item.price_at_purchase * item.quantity
                            }
                        })
                    }

                    if (hasCompanyProductInOrder) {
                        totalOrders += 1
                        totalSalesAmount += companySpecificOrderAmount // Sum only company-relevant sales
                        if (order.status === "pending" || order.status === "confirmed") {
                            pendingOrders += 1
                        }

                        // Aggregate for chart data
                        const orderDate = new Date(order.purchase_time);
                        orderDate.setHours(0, 0, 0, 0);
                        const dateKey = orderDate.toISOString().split('T')[0];
                        
                        if (salesByDate.has(dateKey)) {
                            salesByDate.set(dateKey, salesByDate.get(dateKey)! + 1);
                        }
                    }
                })
            }

            // Prepare dynamic chart data
            const sortedSalesData = Array.from(salesByDate.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
            const chartSalesData = sortedSalesData.map(([date, count]) => count);
            
            // Full date label for tooltips
            const chartSalesLabels = sortedSalesData.map(([date]) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }));
            
            // Short day label for X-axis
            const chartXAxisLabels = sortedSalesData.map(([date]) => new Date(date).toLocaleDateString('en-US', { weekday: 'short' }));


            // 5. All selling products (use full list)
            const allSellingProducts = Object.entries(productSales)
                .map(([productId, data]) => {
                    const productInfo = productDetailsMap.get(productId)
                    return {
                        product_id: productId,
                        product_name: productInfo?.product_name || "Unknown Product",
                        units_sold: data.units,
                        revenue_generated: data.revenue,
                        product_photo_urls: productInfo?.product_photo_urls || [],
                    }
                })
                .sort((a, b) => b.units_sold - a.units_sold)


            setStats({
                companyName,
                totalProducts,
                totalSalesAmount,
                totalOrders,
                pendingOrders,
                activeListings,
                outOfStockProducts,
                lowStockProducts,
                allSellingProducts, 
                chartSalesData,
                chartSalesLabels,
                chartXAxisLabels, // Store new axis labels
            })
            setLoading(false)
        }

        fetchDashboardStats()
    }, [toast])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <span className="ml-3 text-lg text-green-700">Loading dashboard stats...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Error:</strong>
                <span className="block sm:inline"> {error}</span>
            </div>
        )
    }

    return (
        <div className="space-y-10 bg-gradient-to-br from-green-50 via-white to-blue-100 min-h-screen pb-10">
            {/* Professional Top Navbar */}
            <nav className="w-full h-16 px-6 flex items-center justify-between bg-gradient-to-r from-white via-blue-50 to-green-50 shadow-sm rounded-b-2xl mb-8 font-[Inter,sans-serif]">
                <div className="flex items-center gap-3">
                    <ShoppingBag className="h-7 w-7 text-green-500" />
                    <span className="text-xl md:text-2xl font-semibold tracking-tight text-gray-800">Dashboard</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="hidden sm:inline text-base text-gray-700 font-medium">Welcome, {stats?.companyName || "Company"}</span>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-green-100">
                        <Link href="/company/dashboard/my-products" title="My Products">
                            <Package className="h-6 w-6 text-blue-500" />
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-green-100">
                        <Link href="/company/dashboard/my-orders" title="My Orders">
                            <ShoppingCart className="h-6 w-6 text-green-500" />
                        </Link>
                    </Button>
                </div>
            </nav>
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900">Welcome back, {stats?.companyName || "Company"}!</h1>

                {/* Quick Stats Cards */}
                {/* Adjusted grid to 5 columns after removing Pending Orders */}
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mt-8">
                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-pink-100 via-pink-200 to-pink-50 hover:scale-105 transition-transform duration-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-pink-700">Total Products</CardTitle>
                            <Package className="h-5 w-5 text-pink-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-pink-800">{stats?.totalProducts || 0}</div>
                            <p className="text-xs text-pink-600">Products listed</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-blue-100 via-blue-200 to-blue-50 hover:scale-105 transition-transform duration-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700">Total Orders</CardTitle>
                            <ShoppingCart className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-800">{stats?.totalOrders || 0}</div>
                            <p className="text-xs text-blue-600">Orders with your products</p>
                        </CardContent>
                    </Card>

                    {/* This was the location of the removed Pending Orders Card */}

                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-green-100 via-green-200 to-green-50 hover:scale-105 transition-transform duration-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
                            <DollarSign className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-800">₹{stats?.totalSalesAmount.toFixed(2) || "0.00"}</div>
                            <p className="text-xs text-green-600">Generated from your sales</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-purple-100 via-purple-200 to-purple-50 hover:scale-105 transition-transform duration-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-purple-700">Active Listings</CardTitle>
                            <ListChecks className="h-5 w-5 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-800">{stats?.activeListings || 0}</div>
                            <p className="text-xs text-purple-600">Approved and visible</p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-orange-100 via-orange-200 to-orange-50 hover:scale-105 transition-transform duration-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-orange-700">Out of Stock</CardTitle>
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-800">{stats?.outOfStockProducts || 0}</div>
                            <p className="text-xs text-orange-600">Products with zero stock</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sales Overview & Low Stock Alerts */}
                <div className="grid gap-6 lg:grid-cols-3 mt-8">
                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-cyan-50 via-blue-50 to-green-50 hover:scale-105 transition-transform duration-200 lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Sales Overview (Last 7 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 flex items-center justify-center bg-white/80 rounded-lg border border-dashed border-gray-200">
                                {stats?.chartSalesData && stats.chartSalesData.length > 0 ? (
                                    // Display dynamic chart
                                    // @ts-ignore: react-apexcharts has no types
                                    <Chart
                                        options={{
                                            chart: { 
                                                id: "sales-chart", 
                                                toolbar: { show: false },
                                                
                                            },
                                            
                                            // FIX 1: Use chartXAxisLabels for display
                                            xaxis: { 
                                                categories: stats.chartXAxisLabels, 
                                                title: { text: 'Day' } 
                                            },
                                            yaxis: {
                                                // 💡 FIX: Increase space reserved for the Y-axis title
                                                title: { 
                                                    text: 'Number of Orders',
                                                    
                                                    style: {
                                                        color: '#1f2937', 
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                    },
                                                    // Add margin/padding to ensure it's not clipped (often managed by chart.padding/margin in ApexCharts)
                                                    offsetX: 13, // Slight adjustment if needed, but the main fix is the chart.padding
                                                },
                                                labels: { 
                                                    formatter: (val: number) => Math.floor(val) === val ? val.toFixed(0) : '',
                                                    style: {
                                                        colors: ['#4b5563'], // Fixed: Correct property name
                                                    }
                                                },
                                            },
                                            // Use custom tooltip to show full date/day
                                            tooltip: {
                                                x: {
                                                    formatter: function (val, { dataPointIndex }) {
                                                        // This uses the full date label for the hover popup
                                                        return stats.chartSalesLabels[dataPointIndex];
                                                    }
                                                },
                                                y: {
                                                    formatter: function (val) {
                                                        return val.toFixed(0);
                                                    }
                                                }
                                            },
                                            colors: ["#22c55e"],
                                            dataLabels: { enabled: false },
                                            stroke: { curve: "smooth" },
                                            grid: { borderColor: "#e5e7eb" },
                                            // Removed the problematic top-level padding property
                                            markers: {
                                                size: 5,
                                            }
                                        }}
                                        series={[{ name: "Orders", data: stats.chartSalesData }]}
                                        type="line"
                                        height={220}
                                    />
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <p>No sales recorded in the last 7 days.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-white via-green-50 to-green-100 hover:scale-105 transition-transform duration-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" /> Low Stock Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats?.lowStockProducts && stats.lowStockProducts.length > 0 ? (
                                <ul className="space-y-3">
                                    {stats.lowStockProducts.map((product) => (
                                        <li key={product.id} className="flex items-center justify-between gap-3 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 flex-shrink-0 rounded-md overflow-hidden border border-gray-200">
                                                    <Image
                                                        src={product.product_photo_urls?.[0] || "/placeholder.svg"}
                                                        alt={product.product_name}
                                                        className="object-cover w-full h-full"
                                                        width={40}
                                                        height={40}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.product_name}</p>
                                                    <p className="text-xs text-yellow-800 font-semibold">Stock: {product.stock_quantity}</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" asChild className="text-blue-600 border-blue-400 hover:bg-blue-50">
                                                <Link href={`/company/dashboard/edit-product/${product.id}`}>Restock Now</Link>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-4 text-gray-500">
                                    <p>No products with low stock (below 10 units).</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* All Selling Products */}
                <Card className="rounded-2xl shadow-xl border-0 bg-gradient-to-br from-white via-green-50 to-green-100 mt-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingBasket className="h-5 w-5 text-green-600" /> All Selling Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats?.allSellingProducts && stats.allSellingProducts.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Product
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Units Sold
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Revenue
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stats.allSellingProducts.map((product) => (
                                            <tr key={product.product_id} className="hover:bg-green-50 transition-colors duration-150">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10 rounded-md overflow-hidden border border-gray-200">
                                                            <img
                                                                className="h-10 w-10 object-cover"
                                                                src={product.product_photo_urls?.[0] || "/placeholder.svg"}
                                                                alt={product.product_name}
                                                            />
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{product.units_sold}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                                    ₹{product.revenue_generated.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No sales data yet for any product.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}