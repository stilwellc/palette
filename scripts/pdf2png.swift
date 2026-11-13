// Rasterize every page of a PDF to PNG. Usage: pdf2png in.pdf outdir [scale]
import PDFKit
import AppKit
let a = CommandLine.arguments
guard a.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("usage: pdf2png in.pdf outdir [scale]"); exit(1) }
let s = CGFloat(a.count > 3 ? Double(a[3]) ?? 2 : 2)
let base = URL(fileURLWithPath: a[1]).deletingPathExtension().lastPathComponent
for i in 0..<doc.pageCount {
  let p = doc.page(at: i)!, r = p.bounds(for: .mediaBox)
  let w = Int(r.width * s), h = Int(r.height * s)
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.setFillColor(NSColor.white.cgColor); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: s, y: s); p.draw(with: .mediaBox, to: ctx)
  NSGraphicsContext.restoreGraphicsState()
  let name = doc.pageCount == 1 ? "\(base).png" : "\(base)-\(String(format: "%02d", i + 1)).png"
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]).appendingPathComponent(name))
  print(name)
}
