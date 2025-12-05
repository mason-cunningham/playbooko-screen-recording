import { prisma } from "~/server/db";

async function main() {
  const testUserId = "00000000-0000-0000-0000-000000000000";

  await prisma.userProfile.upsert({
    where: {
      email: "account@e2e.net",
    },
    create: {
      id: testUserId,
      name: "E2E Account",
      email: "account@e2e.net",
    },
    update: {},
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
