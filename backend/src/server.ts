import dotenv from "dotenv";
import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

gracefulShutdown(server, {
  signals: "SIGINT SIGTERM",
  timeout: 20000,
  development: true,
  forceExit: false,
  onShutdown: async () => {
    console.log("Performing graceful shutdown...");
  },
  finally() {
    console.log("Shutdown complete. Exiting.");
  },
});
