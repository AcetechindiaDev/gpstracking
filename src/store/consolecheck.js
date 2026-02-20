import { useEffect, useState } from "react";

const IALERT2_BASE = "https://ialertelite.ashokleyland.com";
const IALERT2_TOKEN_STORAGE_KEY = "ialert2_token_v1";
const IALERT2_TOKEN_HARDCODED =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0";

// API path without token in URL
const IALERT2_API_PATH = "/ialert/daas/api/getdata";

export default function Ialert2ConsoleCheck() {
  const [data, setData] = useState("");

  useEffect(() => {
    const fetchData = () => {
      const token =
        localStorage.getItem(IALERT2_TOKEN_STORAGE_KEY) || IALERT2_TOKEN_HARDCODED;

      fetch(`${IALERT2_BASE}${IALERT2_API_PATH}`, {
        method: "GET",
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${token}`, // safer than URL token
        },
        cache: "no-store",
      })
        .then(async (res) => {
          console.log("Status:", res.status);
          const text = await res.text();
          return text;
        })
        .then((data) => {
          console.log("Response:", data);
          setData(data);
        })
        .catch((err) => console.error("Fetch error:", err));
    };

    fetchData();

    const interval = setInterval(fetchData, 10000); // optional: refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3>API Data:</h3>
      <pre>{data}</pre>
    </div>
  );
}