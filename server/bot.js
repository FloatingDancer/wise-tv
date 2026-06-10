import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder 
} from 'discord.js';

let botClient = null;
let triggerRemoteActionFn = null;
let tvSessionsStore = null;
let featuredChannelsList = [];
let allChannelsList = [];

// Helper to create the Remote Control Embed
function createRemoteEmbed(voiceChannelId, channel) {
  return new EmbedBuilder()
    .setTitle('📺 WISE TV - REMOTE CONTROL')
    .setDescription(
      `Sedang Menonton di Voice Channel: <#${voiceChannelId}>\n\n` +
      `**Saluran Aktif:** \`${channel.name}\`\n` +
      `**Kategori:** \`${channel.category}\`\n\n` +
      `*Gunakan tombol dan menu pilihan di bawah untuk mengontrol TV secara real-time untuk semua orang di channel!*`
    )
    .setThumbnail(channel.logo || 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?w=128&h=128&fit=crop')
    .setColor('#5865F2')
    .setFooter({ text: 'Wise TV • Piala Dunia Edition ⚽', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Fifa_world_cup_logo.png' })
    .setTimestamp();
}

// Helper to create Remote Control Components (Buttons & Dropdown)
function createRemoteComponents(voiceChannelId, currentChannelId) {
  // Action Row 1: Buttons
  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`remote_prev_${voiceChannelId}`)
      .setLabel('◀️ Sebelumnya')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`remote_reload_${voiceChannelId}`)
      .setLabel('🔄 Reload')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`remote_next_${voiceChannelId}`)
      .setLabel('▶️ Selanjutnya')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`remote_stop_${voiceChannelId}`)
      .setLabel('❌ Matikan')
      .setStyle(ButtonStyle.Danger)
  );

  // Action Row 2: Select Menu (featured channels)
  // Limit to 25 items (Discord select menu limit)
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`remote_select_${voiceChannelId}`)
    .setPlaceholder('📺 Pilih Saluran TV...');

  const options = featuredChannelsList.slice(0, 25).map(c => ({
    label: c.name,
    value: c.id,
    description: `Kategori: ${c.category}`,
    emoji: c.category === 'Sport' ? '⚽' : (c.category === 'Lokal' ? '🇮🇩' : '🌎'),
    default: c.id === currentChannelId
  }));

  selectMenu.addOptions(options);
  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  return [buttonsRow, selectRow];
}

// Function to register slash commands
async function registerCommands(token, clientId, guildId) {
  const commands = [
    new SlashCommandBuilder()
      .setName('nonton')
      .setDescription('Mulai menonton TV di Voice Channel aktif Anda.'),
    new SlashCommandBuilder()
      .setName('worldcup')
      .setDescription('Mulai menonton saluran Sport / Piala Dunia di Voice Channel aktif Anda.'),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Melihat daftar command dan cara menggunakan Wise TV.')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      console.log(`Registering slash commands to Guild ID: ${guildId}`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    } else {
      console.log('Registering slash commands globally...');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    }
    console.log('Successfully registered Slash Commands!');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

export function initBot(triggerRemoteAction, tvSessions, featuredChannels, allChannels) {
  triggerRemoteActionFn = triggerRemoteAction;
  tvSessionsStore = tvSessions;
  featuredChannelsList = featuredChannels;
  allChannelsList = allChannels;

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error('ERROR: Cannot start bot. Check if DISCORD_TOKEN and DISCORD_CLIENT_ID are set in .env');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  botClient = client;

  client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    registerCommands(token, clientId, guildId);
  });

  // Handle Slash Commands
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'nonton' || commandName === 'worldcup') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: '❌ **Kamu harus berada di Voice Channel terlebih dahulu untuk menonton TV!** Please join a voice channel and try again.',
          ephemeral: true
        });
      }

      // Check if there is a default channel for worldcup, or fallback to featured
      let defaultChannel = featuredChannelsList[0]; // TVRI Nasional
      if (commandName === 'worldcup') {
        const sportChannel = featuredChannelsList.find(c => c.category === 'Sport');
        if (sportChannel) defaultChannel = sportChannel;
      }

      try {
        // 1. Send LAUNCH_ACTIVITY (type 12) callback to Discord
        // This instructs Discord Client to open the embedded app in the voice channel
        console.log(`Launching Activity in voice channel ${voiceChannel.id} for user ${interaction.user.tag}`);
        await interaction.client.rest.post(
          Routes.interactionCallback(interaction.id, interaction.token),
          { 
            body: { 
              type: 12, // LAUNCH_ACTIVITY
            } 
          }
        );

        // Save session state
        tvSessionsStore.set(voiceChannel.id, defaultChannel);

        // 2. Post the Remote Control in the text channel
        await interaction.channel.send({
          embeds: [createRemoteEmbed(voiceChannel.id, defaultChannel)],
          components: createRemoteComponents(voiceChannel.id, defaultChannel.id)
        });

      } catch (error) {
        console.error('Failed to launch activity:', error);
        
        // If launch activity callback failed (e.g. app hasn't enabled Activities), send a fallback web link
        const webUrl = `http://localhost:3000/?voiceChannelId=${voiceChannel.id}`;
        await interaction.reply({
          content: `⚠️ **Gagal membuka Activity otomatis.** Pastikan fitur Activity sudah diaktifkan di Developer Portal Anda.\n\nSebagai alternatif, Anda bisa menonton secara manual lewat browser di link berikut:\n🔗 **[Buka Wise TV Player](${webUrl})**`,
          ephemeral: true
        });
      }
    }

    if (commandName === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📺 Bantuan Wise TV')
        .setDescription(
          'Wise TV adalah Discord Activity & Bot untuk menonton TV lokal, internasional, dan olahraga bersama di server Anda!\n\n' +
          '**Daftar Command:**\n' +
          '• `/nonton` - Membuka TV Player (Activity) di Voice Channel Anda dan memposting remote di chat.\n' +
          '• `/worldcup` - Membuka TV Player langsung pada saluran olahraga/bola.\n' +
          '• `/help` - Membuka halaman bantuan ini.'
        )
        .addFields(
          { name: '🎮 Cara Menonton', value: '1. Masuk ke salah satu **Voice Channel**.\n2. Ketik `/nonton` di text channel.\n3. Panel video akan terbuka di Voice Channel Anda, dan remote control akan muncul di text channel.' },
          { name: '🎛️ Cara Memakai Remote', value: 'Gunakan tombol di bawah embed remote untuk ganti channel sebelumnya/selanjutnya atau memuat ulang siaran. Semua orang yang menonton di voice channel tersebut akan tersinkronisasi otomatis.' }
        )
        .setColor('#5865F2');

      await interaction.reply({ embeds: [helpEmbed] });
    }
  });

  // Handle Button & Dropdown Interactions (Remote Control)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('remote_')) return;

    const parts = customId.split('_'); // [remote, action, voiceChannelId]
    const action = parts[1];
    const voiceChannelId = parts[2];

    const currentChannel = tvSessionsStore.get(voiceChannelId) || featuredChannelsList[0];
    let targetChannel = currentChannel;

    if (action === 'select' && interaction.isStringSelectMenu()) {
      const selectedId = interaction.values[0];
      const found = featuredChannelsList.find(c => c.id === selectedId) || allChannelsList.find(c => c.id === selectedId);
      if (found) targetChannel = found;
    } else if (action === 'next') {
      const currentIndex = featuredChannelsList.findIndex(c => c.id === currentChannel.id);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % featuredChannelsList.length;
        targetChannel = featuredChannelsList[nextIndex];
      }
    } else if (action === 'prev') {
      const currentIndex = featuredChannelsList.findIndex(c => c.id === currentChannel.id);
      if (currentIndex !== -1) {
        const prevIndex = (currentIndex - 1 + featuredChannelsList.length) % featuredChannelsList.length;
        targetChannel = featuredChannelsList[prevIndex];
      }
    } else if (action === 'reload') {
      // Trigger reload event to SSE clients
      triggerRemoteActionFn(voiceChannelId, { action: 'reload' });
      return interaction.reply({ content: '🔄 Mengirim sinyal reload ke pemutar TV...', ephemeral: true });
    } else if (action === 'stop') {
      // Trigger stop event to SSE clients
      triggerRemoteActionFn(voiceChannelId, { action: 'stop' });
      
      // Update remote embed
      const stoppedEmbed = new EmbedBuilder()
        .setTitle('📺 WISE TV - NONAKTIF')
        .setDescription(`Sesi TV di Voice Channel <#${voiceChannelId}> telah dihentikan oleh <@${interaction.user.id}>.`)
        .setColor('#ED4245')
        .setTimestamp();

      await interaction.update({ embeds: [stoppedEmbed], components: [] });
      return;
    }

    // Update state and trigger SSE event
    tvSessionsStore.set(voiceChannelId, targetChannel);
    triggerRemoteActionFn(voiceChannelId, { action: 'change-channel', channel: targetChannel });

    // Update the message components and embed to show new active channel
    await interaction.update({
      embeds: [createRemoteEmbed(voiceChannelId, targetChannel)],
      components: createRemoteComponents(voiceChannelId, targetChannel.id)
    });
  });

  client.login(token);
}
