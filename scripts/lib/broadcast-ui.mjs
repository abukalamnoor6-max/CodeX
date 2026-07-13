import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
} from "discord.js";
import { ORDER_PAYMENTS } from "./order-catalog.mjs";

function bcMenu(counts = { all: 0, online: 0, offline: 0 }) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("bc_menu")
        .setPlaceholder("...اختر العملية")
        .addOptions([
          {
            label: "إرسال للجميع",
            description: `إرسال رسالة لجميع الأعضاء (${counts.all})`,
            value: "all",
            emoji: "📬",
          },
          {
            label: "إرسال للمتصلين",
            description: `إرسال للأعضاء المتصلين فقط (${counts.online})`,
            value: "online",
            emoji: "🟢",
          },
          {
            label: "إرسال لغير المتصلين",
            description: `إرسال للأعضاء غير المتصلين (${counts.offline})`,
            value: "offline",
            emoji: "⚫",
          },
          {
            label: "إرسال لرتبة معينة",
            description: "إرسال لأعضاء رتبة محددة",
            value: "role",
            emoji: "🎭",
          },
          {
            label: "إرسال لشخص معين",
            description: "إرسال رسالة خاصة لعضو محدد",
            value: "user",
            emoji: "🎯",
          },
        ]),
    ),
  ];
}

function messageModal(filter, extraId = "") {
  const customId = extraId ? `bc_modal_${filter}_${extraId}` : `bc_modal_${filter}`;
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("نص البرودكاست")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("content")
          .setLabel("الرسالة")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000),
      ),
    );
}

export function attachBroadcastUi({ client, store, broadcast, ownerId, guildId }) {
  client.on("interactionCreate", async (i) => {
    try {
      if (!i.guild || i.guild.id !== guildId) return;

      if (i.isChatInputCommand() && i.commandName === "bc-panel") {
        if (!broadcast.canUse(i.member)) {
          return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
        }
        const counts = await broadcast.countTargets(i.guildId);
        const embed = new EmbedBuilder()
          .setTitle("📢 نظام البرودكاست — 𝐂𝐨𝐝𝐞𝐗")
          .setDescription("اختر نوع الإرسال من القائمة تحت")
          .setColor(0x2dd4bf)
          .addFields(
            { name: "الجميع", value: `\`${counts.all}\``, inline: true },
            { name: "متصل", value: `\`${counts.online}\``, inline: true },
            { name: "غير متصل", value: `\`${counts.offline}\``, inline: true },
          );
        return i.reply({
          embeds: [embed],
          components: [
            ...bcMenu(counts),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("bc_cancel_btn")
                .setLabel("إلغاء البرودكاست الحالي")
                .setStyle(ButtonStyle.Danger),
            ),
          ],
          ephemeral: true,
        });
      }

      if (i.isButton() && i.customId === "bc_cancel_btn") {
        if (!broadcast.canUse(i.member)) {
          return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
        }
        const ok = broadcast.cancel(i.guildId);
        return i.reply({
          content: ok ? "✅ تم الإلغاء" : "لا يوجد برودكاست شغّال",
          ephemeral: true,
        });
      }

      if (i.isStringSelectMenu() && i.customId === "bc_menu") {
        if (!broadcast.canUse(i.member)) {
          return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
        }
        const filter = i.values[0];
        if (filter === "role") {
          return i.update({
            content: "🎭 اختر الرتبة:",
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                  .setCustomId("bc_pick_role")
                  .setPlaceholder("اختر رتبة")
                  .setMinValues(1)
                  .setMaxValues(1),
              ),
            ],
          });
        }
        if (filter === "user") {
          return i.update({
            content: "🎯 اختر العضو:",
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                  .setCustomId("bc_pick_user")
                  .setPlaceholder("اختر عضو")
                  .setMinValues(1)
                  .setMaxValues(1),
              ),
            ],
          });
        }
        return i.showModal(messageModal(filter));
      }

      if (i.isRoleSelectMenu() && i.customId === "bc_pick_role") {
        return i.showModal(messageModal("role", i.values[0]));
      }
      if (i.isUserSelectMenu() && i.customId === "bc_pick_user") {
        return i.showModal(messageModal("user", i.values[0]));
      }

      if (i.isModalSubmit() && i.customId.startsWith("bc_modal_")) {
        if (!broadcast.canUse(i.member)) {
          return i.reply({ content: "❌ لا صلاحية", ephemeral: true });
        }
        const parts = i.customId.replace("bc_modal_", "").split("_");
        const filter = parts[0];
        const extraId = parts.slice(1).join("_") || null;
        const content = i.fields.getTextInputValue("content");
        await i.deferReply({ ephemeral: true });
        try {
          const job = await broadcast.startBroadcast({
            guildId: i.guildId,
            content,
            filter,
            roleId: filter === "role" ? extraId : null,
            userId: filter === "user" ? extraId : null,
            requestedBy: i.user.id,
          });
          await i.editReply(`✅ بدأ الإرسال لـ **${job.total}** عضو.`);
        } catch (e) {
          await i.editReply(`❌ ${e.message}`);
        }
      }
    } catch (e) {
      console.error("[bc-ui]", e.message);
    }
  });
}

export async function registerPanelCommands(client, guildId) {
  const body = [
    new SlashCommandBuilder()
      .setName("order")
      .setDescription("إنشاء فاتورة طلب في روم الطلبات")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addUserOption((o) =>
        o.setName("user").setDescription("العميل").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("order_id")
          .setDescription("رقم الطلب / الفاتورة")
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("product")
          .setDescription("المنتج — اكتب للبحث (كل منتجات المتجر)")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((o) =>
        o
          .setName("amount")
          .setDescription("المبلغ — اكتب للبحث (كل أسعارك)")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((o) =>
        o
          .setName("payment")
          .setDescription("طريقة الدفع")
          .setRequired(true)
          .addChoices(...ORDER_PAYMENTS),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("bc-panel")
      .setDescription("لوحة البرودكاست")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("setup-logs")
      .setDescription("إنشاء رومات اللوقات الناقصة")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("logs-info")
      .setDescription("عرض رومات اللوقات")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("set-staff")
      .setDescription("رتبة إجراءات اللوقات")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addRoleOption((o) =>
        o.setName("role").setDescription("الرتبة").setRequired(true),
      )
      .toJSON(),
  ];
  const rest = new REST({ version: "10" }).setToken(client.token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
    body,
  });
}
