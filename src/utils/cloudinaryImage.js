// Cloudinary applies on-the-fly transformations when they're inserted into
// the URL's path — right after "/upload/" — not as query params, e.g.:
//   https://res.cloudinary.com/<cloud>/image/upload/v169.../student-profiles/x.jpg
// becomes:
//   https://res.cloudinary.com/<cloud>/image/upload/q_auto,f_auto/v169.../student-profiles/x.jpg
function withTransform(url, transformation) {
  if (!url || !url.includes("/upload/")) return url;

  return url.replace("/upload/", `/upload/${transformation}/`);
}

// Used everywhere a profile picture renders as a fixed-size avatar/thumbnail
// (student cards, list rows, edit/detail previews) — q_auto/f_auto pick the
// smallest acceptable quality/format for the requesting browser, w_200/h_200
// + c_fill crop to a consistent square instead of shipping the original
// (potentially multi-MB) upload every time the same photo is shown small.
export function getThumbnailUrl(url) {
  return withTransform(url, "q_auto,f_auto,w_200,h_200,c_fill");
}
