// چکِ magic bytes -- مکملِ چکِ file.type که کلاینت می‌فرسته و به‌سادگی قابلِ
// جعله (یه فایلِ دلخواه با پسوند/MIME جعلی می‌تونه از چکِ ALLOWED_TYPES رد بشه).
// این فقط همون فرمت‌هایی که این پروژه واقعاً آپلود می‌کنه (jpg/png/gif/webp/
// mp4/webm/mov) رو تأیید می‌کنه، نه یه کتابخونه‌ی عمومیِ file-type.
const QUICKTIME_ATOM_TYPES = new Set(["ftyp", "moov", "free", "mdat", "wide", "skip", "pnot"]);

export function fileMatchesDeclaredType(buffer: Buffer, declaredMimeType: string): boolean {
  switch (declaredMimeType) {
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/gif":
      return (
        buffer.length >= 6 &&
        (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")
      );
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
    case "video/mp4":
    case "video/quicktime":
      // هر دو فرمتِ خانواده‌ی ISO-BMFF/QuickTime‌ان و اتم‌های اول یکسانی دارن --
      // تمایزِ دقیقِ mp4 از mov از رویِ بایت‌ها قابلِ‌اتکا نیست، فقط تأیید می‌کنیم
      // که واقعاً یه کانتینرِ ویدیوییِ همین خانواده‌ست
      return buffer.length >= 8 && QUICKTIME_ATOM_TYPES.has(buffer.toString("ascii", 4, 8));
    case "video/webm":
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      );
    default:
      return false;
  }
}
