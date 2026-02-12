import axios from 'axios'

// Create axios instance that points to Next.js API proxy
const axiosInstance = axios.create({
  baseURL: typeof window !== 'undefined' ? '' : 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default axiosInstance
