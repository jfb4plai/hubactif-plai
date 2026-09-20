import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrImage({ text, size = 180, alt = 'QR code' }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(text, { margin: 1, width: size }).then((url) => { if (live) setSrc(url) }).catch(() => {})
    return () => { live = false }
  }, [text, size])
  return src ? <img src={src} width={size} height={size} alt={alt} /> : null
}
