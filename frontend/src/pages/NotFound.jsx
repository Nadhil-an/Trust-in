import React from "react"
import { Link } from "react-router-dom"
export default function NotFoundPage() {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"70vh",textAlign:"center"}}>
      <h1 style={{fontSize:80,margin:0,color:"var(--primary-600)"}}>404</h1>
      <h2 style={{fontSize:24,margin:"16px 0",color:"var(--gray-900)"}}>Page not found</h2>
      <p style={{color:"var(--gray-500)",marginBottom:32}}>The page you are looking for doesn't exist or you don't have permission to view it.</p>
      <Link to="/" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  )
}
