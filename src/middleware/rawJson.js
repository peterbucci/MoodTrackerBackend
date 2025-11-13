import getRawBody from "raw-body";

export const rawJson = async (req, res, next) => {
  try {
    const buf = await getRawBody(req, {
      length: req.headers["content-length"],
      encoding: null,
    });
    req.rawBodyBuffer = buf;
    req.rawBody = buf.toString("utf8");
    try {
      req.body = JSON.parse(req.rawBody);
    } catch {
      req.body = {};
    }
    next();
  } catch (e) {
    next(e);
  }
};
