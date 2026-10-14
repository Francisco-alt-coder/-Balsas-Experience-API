/** Compartilha um cliente Prisma com adaptador PostgreSQL entre os módulos da API. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {configurarBanco} from './database-config.js';

const adapter = new PrismaPg(configurarBanco());
const prisma = new PrismaClient({ adapter });

export default prisma;
