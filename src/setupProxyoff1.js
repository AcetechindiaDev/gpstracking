
    const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // ✅ FleetX
  app.use(
    "/api/fleetx",
    createProxyMiddleware({
      target: "https://api.fleetx.io",
      changeOrigin: true,
      pathRewrite: { "^/api/fleetx": "" },
      secure: true,
    })
  );

  // ✅ JTrack
  app.use(
    "/api/jtrack",
    createProxyMiddleware({
      target: "https://jtrack.in",
      changeOrigin: true,
      pathRewrite: { "^/api/jtrack": "" },
      secure: true,
    })
  );

  // ✅ VECV
  app.use(
    "/api/vecv",
    createProxyMiddleware({
      target: "https://partnerapi.vecv.net",
      changeOrigin: true,
      pathRewrite: { "^/api/vecv": "" },
      secure: true,
      logLevel: "debug",
    })
  );

  // ✅ Batchmaster
  app.use(
    "/api/batch",
    createProxyMiddleware({
      target: "https://gcc.batchmaster.in",
      changeOrigin: true,
      pathRewrite: { "^/api/batch": "" },
      secure: true,
      logLevel: "debug",
    })
  );

  // ✅ GPSTRACK
  app.use(
    "/api/gpstrack",
    createProxyMiddleware({
      target: "https://app.gpstrack.in",
      changeOrigin: true,
      pathRewrite: { "^/api/gpstrack": "" },
      secure: true,
      logLevel: "debug",
    })
  );

  // ✅ iALERT2
  app.use(
    "/api/ialert2",
    createProxyMiddleware({
      target: "https://ialertelite.ashokleyland.com",
      changeOrigin: true,
      pathRewrite: { "^/api/ialert2": "" },
      secure: false,
      logLevel: "debug",
    })
  );
// ✅ iALERT2 (FIXED PATH)
// app.use(
//   "/api/ialert2",
//   createProxyMiddleware({
//     target: "https://ialertelite.ashokleyland.com",
//     changeOrigin: true,
//     secure: true,
//     logLevel: "debug",

//     // ✅ IMPORTANT: point proxy to the correct base path
//     pathRewrite: { "^/api/ialert2": "/ialert/daas/api" },

//     onProxyReq: (proxyReq, req) => {
//       // ✅ Helps when server checks origin/referer
//       proxyReq.setHeader("origin", "https://ialertelite.ashokleyland.com");
//       proxyReq.setHeader("referer", "https://ialertelite.ashokleyland.com/");

//       // ✅ Forward auth if you ever send it
//       if (req.headers.authorization) {
//         proxyReq.setHeader("authorization", req.headers.authorization);
//       }
//     },
//   })
// );


  // ✅ VAMOSYS (FIXED)
  app.use(
    "/api/vamosys",
    createProxyMiddleware({
      target: "https://api.vamosys.com",
      changeOrigin: true,
      pathRewrite: { "^/api/vamosys": "" },
      secure: false, // same as iAlert2
      logLevel: "debug",
    })
  );
};

