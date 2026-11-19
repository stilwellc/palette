// Assemble PNG frames (sorted by name) into a looping GIF.
// Usage: frames2gif <framesdir> <out.gif> <delaySeconds> <holdLastSeconds>
import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers
let a = CommandLine.arguments
guard a.count >= 5, let delay = Double(a[3]), let hold = Double(a[4]) else { print("usage: frames2gif framesdir out.gif delaySeconds holdLastSeconds"); exit(1) }
let dir = URL(fileURLWithPath: a[1]), out = URL(fileURLWithPath: a[2])
let files = ((try? FileManager.default.contentsOfDirectory(atPath: a[1])) ?? []).filter { $0.hasSuffix(".png") }.sorted()
guard !files.isEmpty, let dst = CGImageDestinationCreateWithURL(out as CFURL, UTType.gif.identifier as CFString, files.count, nil) else { print("no PNG frames in \(a[1]), or cannot write \(a[2])"); exit(1) }
CGImageDestinationSetProperties(dst, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for (i, f) in files.enumerated() {
  guard let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(f) as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read \(f)"); exit(1) }
  let d = i == files.count - 1 ? max(hold, delay) : delay
  CGImageDestinationAddImage(dst, img, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFUnclampedDelayTime: d, kCGImagePropertyGIFDelayTime: d]] as CFDictionary)
}
guard CGImageDestinationFinalize(dst) else { print("could not write \(a[2])"); exit(1) }
print(files.count)
