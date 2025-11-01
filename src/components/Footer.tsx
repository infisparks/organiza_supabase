"use client"

import Link from "next/link"
import { Leaf, Facebook, Instagram, Twitter, Linkedin, Mail, Phone } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-white">
              <Leaf className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold">Organixa</span>
            </Link>
            <p className="text-sm leading-relaxed">
              Your trusted source for premium organic products, delivered fresh to your door.
            </p>
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/shop" className="text-sm hover:text-white transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-sm hover:text-white transition-colors">
                  My Orders
                </Link>
              </li>
              <li>
                <Link href="/addfav" className="text-sm hover:text-white transition-colors">
                  My Favourites
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-sm hover:text-white transition-colors">
                  My Carts
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/orders" className="text-sm hover:text-white transition-colors">
                  My Orders
                </Link>
              </li>
              <li>
                <Link href="/returns" className="text-sm hover:text-white transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-sm hover:text-white transition-colors">
                  Shipping Information
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <address className="not-italic space-y-2 text-sm">
              <p>123 Organic Lane, Green City, GC 12345</p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                <a href="tel:+1234567890" className="hover:text-white transition-colors">
                  +1 (234) 567-890
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-500" />
                <a href="mailto:info@organixa.com" className="hover:text-white transition-colors">
                  info@organixa.com
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-10 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Organixa. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
