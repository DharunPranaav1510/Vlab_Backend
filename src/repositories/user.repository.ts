import { prisma } from "../config/prisma.js";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data: { email: string; name: string; passwordHash: string }) {
    return prisma.user.create({ data });
  },
  updateReset(email: string, token: string, exp: Date) {
    return prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExp: exp }
    });
  },
  async resetPassword(token: string, passwordHash: string) {
    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) return null;
    return prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null }
    });
  }
};
