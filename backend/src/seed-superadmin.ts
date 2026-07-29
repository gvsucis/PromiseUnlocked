import { admin, usersCollection } from "@/services/firestore";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? process.argv[2];
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? process.argv[3];
const DISPLAY_NAME = process.env.SUPER_ADMIN_DISPLAY_NAME ?? "Super Admin";

async function seedSuperAdmin() {
  if (!EMAIL || !PASSWORD) {
    console.error(
      "Usage: tsx src/seed-superadmin.ts <email> <password>\n" +
        "Or set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars."
    );
    process.exit(1);
  }

  if (PASSWORD.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const existingUser = await admin
    .auth()
    .getUserByEmail(EMAIL)
    .catch(() => null);
  if (existingUser) {
    console.error(`User ${EMAIL} already exists (uid: ${existingUser.uid}).`);
    console.error("If you want to promote them to superadmin, use PATCH /users/:uid/role.");
    process.exit(1);
  }

  const userRecord = await admin.auth().createUser({
    email: EMAIL,
    password: PASSWORD,
    displayName: DISPLAY_NAME,
  });

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    role: "superadmin",
    admin: true,
  });

  await usersCollection.doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: EMAIL,
    displayName: DISPLAY_NAME,
    photoURL: null,
    role: "superadmin",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {},
  });

  console.log(`Superadmin created:`);
  console.log(`  uid:   ${userRecord.uid}`);
  console.log(`  email: ${EMAIL}`);
  console.log(`  role:  superadmin`);
}

seedSuperAdmin().catch((err) => {
  console.error("Failed to seed superadmin:", err);
  process.exit(1);
});