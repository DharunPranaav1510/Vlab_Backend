import { prisma } from "../config/prisma.js";
export const userRepository = {
    findByEmail(email) {
        return prisma.user.findUnique({ where: { email } });
    },
    findById(id) {
        return prisma.user.findUnique({ where: { id } });
    },
    create(data) {
        return prisma.user.create({ data });
    },
    updateReset(email, token, exp) {
        return prisma.user.update({
            where: { email },
            data: { resetToken: token, resetTokenExp: exp }
        });
    },
    async resetPassword(token, passwordHash) {
        const user = await prisma.user.findFirst({ where: { resetToken: token } });
        if (!user)
            return null;
        return prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, resetToken: null, resetTokenExp: null }
        });
    }
};
