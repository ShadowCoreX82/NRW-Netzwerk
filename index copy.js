// Importiere die benötigten Module von discord.js
const { Client, Events, GatewayIntentBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ApplicationCommandOptionType, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
require('dotenv').config();

// NEU: Importiere den Log-Bot und hole die log-funktion
const setupLogBot = require('./logBot.js');
let logToChannel; // Variable, um die log-Funktion zu speichern

// Erstelle eine neue Discord-Client-Instanz mit den notwendigen Intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;

const SUPPORT_ROLE_ID = '1399462359571103958'; // Z.B. Moderatoren-Rolle
const EVERYONE_ROLE_ID = '1399455760735272990'; // Die @everyone Rolle ID deines Servers

// ACHTUNG: ERSETZE DIESE MIT DEINEN EIGENEN KATEGORIE-ID'S!
const TICKET_CATEGORY_MAP = {
    'general_inquiry': '1399463058035966135', // Beispiel: Kategorie ID für allgemeine Anfragen
    'technical_support': '1399826308850122883', // Beispiel: Kategorie ID für technischen Support
    'individual_offers': '1399826433265635428', // Beispiel: Kategorie ID für Einzel Angebote
    'package_offers': '1399826541084414103', // Beispiel: Kategorie ID für Paket Angebote
};

const LOG_CHANNEL_ID = '1399495214644858880'; // Kanal-ID für Bot-Logs
const VERIFICATION_CHANNEL_ID = '1399463428906649721'; // Kanal-ID für das Verifizierungspanel
const VERIFIED_ROLE_ID = '1399463553255393301'; // ID der Rolle, die nach der Verifizierung vergeben wird
const UNVERIFIED_ROLE_ID = '1399463660503027870'; // ID der Rolle für unbestätigte Benutzer (falls verwendet)
const WELCOME_CHANNEL_ID = '1399463784112255099'; // Optional: Kanal-ID für Willkommensnachrichten
const VOICE_PING_ROLE_ID = '1399463901691238401'; // ID der Rolle, die bei Sprachkanal-Beitritt gepingt werden soll
const VOICE_PING_CHANNEL_ID = '1399464010619881472'; // Kanal-ID, in den der Voice-Ping gesendet werden soll
const EMBED_CREATOR_ROLE_ID = '1399464112467558913'; // Rolle, die Embeds erstellen darf


// In-Memory-Speicher für die letzten Logs (für den search-logs Befehl)
const recentLogs = [];
const MAX_RECENT_LOGS = 100; // Maximale Anzahl der im Speicher gehaltenen Logs

// Funktion zum Speichern und Loggen
const saveAndLog = async (message, embed = null) => {
    // Füge den Log zu den recentLogs hinzu
    recentLogs.push({ message, embed: embed ? embed.toJSON() : null, timestamp: new Date() });
    if (recentLogs.length > MAX_RECENT_LOGS) {
        recentLogs.shift(); // Ältesten Log entfernen
    }
    // Sende den Log auch über die Log-Bot-Funktion
    if (logToChannel) {
        await logToChannel(message, embed);
    }
};

// Wenn der Bot bereit ist, starte ihn
client.once(Events.ClientReady, async c => {
    console.log(`Bereit! Eingeloggt als ${c.user.tag}`);

    // Initialisiere den Log-Bot und speichere die log-Funktion
    logToChannel = setupLogBot(client, LOG_CHANNEL_ID);
    await saveAndLog(`Bot gestartet und eingeloggt als ${c.user.tag}`);
});


// Transcript-Funktion (unverändert)
async function createAndSendTranscript(channel, closer) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const transcriptContent = messages
        .reverse() // Älteste Nachrichten zuerst
        .map(msg => `${new Date(msg.createdTimestamp).toLocaleString()}: ${msg.author.tag}: ${msg.content}`)
        .join('\n');

    const attachment = new AttachmentBuilder(Buffer.from(transcriptContent), { name: `transcript-${channel.name}.txt` });

    const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.type === ChannelType.GuildText) {
        const embed = new EmbedBuilder()
            .setTitle('Ticket-Transkript')
            .setDescription(`Transkript des Tickets "${channel.name}", geschlossen von ${closer.tag}.`)
            .setColor(0xADD8E6)
            .setTimestamp();
        await logChannel.send({ embeds: [embed], files: [attachment] });
        await saveAndLog(`Transkript für Ticket "${channel.name}" von ${closer.tag} erstellt und gesendet.`);
    } else {
        console.error('Log-Kanal für Transkripte nicht gefunden oder ist kein Textkanal.');
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const { commandName } = interaction;
        const hasRequiredRole = (member, roleId) => {
            return member && member.roles.cache.has(roleId);
        };

        if (commandName === 'sendticketpanel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: 'Du hast nicht die Berechtigung, dies zu tun!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Support Ticket')
                .setDescription('Wähle unten im Dropdown-Menü den Grund für dein Ticket aus, um ein Support-Ticket zu öffnen.')
                .setColor(0x0099FF)
                .setFooter({ text: 'Apex | Apex Ticket' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_select')
                        .setPlaceholder('Wähle einen Ticket-Typ...')
                        .addOptions([
                            {
                                label: 'Allgemeine Anfrage',
                                description: 'Für allgemeine Fragen oder Anliegen.',
                                value: 'general_inquiry',
                                emoji: '💡',
                            },
                            {
                                label: 'Technischer Support',
                                description: 'Für Probleme mit Bots oder anderen technischen Angelegenheiten.',
                                value: 'technical_support',
                                emoji: '⚙️',
                            },
                            {
                                label: 'Einzel Angebote',
                                description: 'Für Fragen zum Kauf oder zur Funktion von Einzel Angeboten',
                                value: 'individual_offers',
                                emoji: '🤖',
                            },
                            {
                                label: 'Paket Angebote',
                                description: 'Für Fragen zum Kauf oder zur Funktion von Paket Angeboten',
                                value: 'package_offers',
                                emoji: '🎁',
                            },
                        ]),
                );

            try {
                await interaction.reply({ embeds: [embed], components: [row] });
                console.log('Ticket-Panel mit Dropdown erfolgreich gesendet.');
            } catch (error) {
                console.error('Fehler beim Senden des Ticket-Panels:', error);
            }
        } else if (commandName === 'sendverificationpanel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: 'Du hast nicht die Berechtigung, das Verifizierungspanel zu senden!', ephemeral: true });
            }
            const verificationChannel = interaction.guild.channels.cache.get(VERIFICATION_CHANNEL_ID);
            if (!verificationChannel) {
                return interaction.reply({ content: 'Der Verifizierungskanal wurde nicht gefunden. Bitte überprüfe VERIFICATION_CHANNEL_ID.', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            try {
                await sendVerificationPanel(verificationChannel);
                await interaction.followUp({ content: `Verifizierungspanel erfolgreich in ${verificationChannel} gesendet.`, ephemeral: true });
            } catch (error) {
                console.error('Fehler beim Senden des Verifizierungspanels:', error);
                await interaction.followUp({ content: 'Fehler beim Senden des Verifizierungspanels. Überprüfe die Bot-Berechtigungen.', ephemeral: true });
            }
        } else if (commandName === 'create-embed') {
            if (!hasRequiredRole(interaction.member, EMBED_CREATOR_ROLE_ID)) {
                return interaction.reply({ content: 'Du hast nicht die Berechtigung, Embeds zu erstellen!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const color = interaction.options.getString('color');
            const footer = interaction.options.getString('footer');
            const image = interaction.options.getString('image');
            const thumbnail = interaction.options.getString('thumbnail');
            const channel = interaction.options.getChannel('channel');
            const embed = new EmbedBuilder();
            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            if (color) {
                try {
                    embed.setColor(color.startsWith('#') ? color : `#${color}`);
                } catch (e) {
                    console.error('Ungültiges Farbformat:', color, e);
                    embed.setColor(0x0099FF);
                    await interaction.followUp({ content: 'Ungültiges Farbformat angegeben. Das Embed wurde mit Standardfarbe gesendet.', ephemeral: true });
                }
            } else {
                embed.setColor(0x0099FF);
            }
            if (footer) embed.setFooter({ text: footer });
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);
            embed.setTimestamp();
            const targetChannel = channel || interaction.channel;
            try {
                await targetChannel.send({ embeds: [embed] });
                await interaction.followUp({ content: `Embed erfolgreich in ${targetChannel} gesendet!`, ephemeral: true });
                await saveAndLog(`Embed von ${interaction.user.tag} in ${targetChannel.name} erstellt.`, embed);
            } catch (error) {
                console.error('Fehler beim Senden des erstellten Embeds:', error);
                await interaction.followUp({ content: `Fehler beim Senden des Embeds: ${error.message}. Stelle sicher, dass der Bot Schreibberechtigungen im Kanal hat und die URLs gültig sind.`, ephemeral: true });
            }
        }
        else if (commandName === 'search-logs') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: 'Du hast nicht die Berechtigung, Logs zu suchen!', ephemeral: true });
            }

            const query = interaction.options.getString('query').toLowerCase();
            const filteredLogs = recentLogs.filter(log =>
                log.message.toLowerCase().includes(query) || (log.embed && JSON.stringify(log.embed).toLowerCase().includes(query))
            );

            if (filteredLogs.length === 0) {
                return interaction.reply({ content: `Keine Logs gefunden, die zu "${query}" passen.`, ephemeral: true });
            }

            const logEmbeds = [];
            for (let i = 0; i < Math.min(filteredLogs.length, 10); i++) {
                const log = filteredLogs[i];
                const embed = new EmbedBuilder()
                    .setTitle(`Log #${i + 1}`)
                    .setDescription(log.message)
                    .setColor(0xADD8E6)
                    .setTimestamp(log.timestamp);
                if (log.embed) {
                    embed.addFields({ name: 'Original Embed Details', value: `\`\`\`json\n${JSON.stringify(log.embed, null, 2).substring(0, 1000)}...\n\`\`\``, inline: false });
                }
                logEmbeds.push(embed);
            }

            await interaction.reply({
                content: `Gefundene Logs für "${query}" (Anzahl: ${filteredLogs.length}, zeige max. 10):`,
                embeds: logEmbeds,
                ephemeral: true
            });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select') {
            await interaction.deferReply({ ephemeral: true });
            const selectedReason = interaction.values[0];
            const ticketCreatorId = interaction.user.id;
            // NEU: Ticket-Name basiert nur auf dem Benutzernamen
            const ticketNamePrefix = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            // NEU: Hole die Kategorie-ID basierend auf der Auswahl
            const categoryIdToUse = TICKET_CATEGORY_MAP[selectedReason];

            if (!categoryIdToUse) {
                console.error(`Fehler: Keine Kategorie-ID für den Ticket-Typ "${selectedReason}" in TICKET_CATEGORY_MAP gefunden.`);
                return interaction.followUp({ content: 'Ein interner Fehler ist aufgetreten: Keine passende Ticket-Kategorie gefunden. Bitte informiere einen Administrator oder überprüfe die Bot-Konfiguration.', ephemeral: true });
            }
            // Überprüfe, ob die Kategorie existiert
            const categoryChannel = interaction.guild.channels.cache.get(categoryIdToUse);
            if (!categoryChannel || categoryChannel.type !== ChannelType.GuildCategory) {
                console.error(`Fehler: Die Kategorie mit ID ${categoryIdToUse} existiert nicht oder ist keine Kategorie.`);
                return interaction.followUp({ content: 'Die konfigurierte Ticket-Kategorie existiert nicht oder ist keine gültige Kategorie. Bitte informiere einen Administrator.', ephemeral: true });
            }


            try {
                let existingTicket = interaction.guild.channels.cache.find(c =>
                    c.name.startsWith(ticketNamePrefix) &&
                    c.topic && c.topic.includes(ticketCreatorId) &&
                    c.type === ChannelType.GuildText
                );

                if (existingTicket) {
                    try {
                        const fetchedTicket = await interaction.guild.channels.fetch(existingTicket.id);
                        if (fetchedTicket) {
                           existingTicket = fetchedTicket;
                        } else {
                           existingTicket = null;
                        }
                    } catch (error) {
                        if (error.code === 10003) {
                            existingTicket = null;
                        } else {
                            console.error(`Unerwarteter Fehler beim Abrufen des bestehenden Tickets:`, error);
                            return interaction.followUp({ content: 'Ein unerwarteter Fehler ist beim Überprüfen auf bestehende Tickets aufgetreten. Bitte versuche es später erneut.', ephemeral: true });
                        }
                    }
                }

                if (existingTicket) {
                    return interaction.followUp({ content: `Du hast bereits ein offenes Ticket: ${existingTicket}`, ephemeral: true });
                }

                // NEU: Kanalname ist nur der Ticket-Prefix (Benutzername)
                let ticketChannel;
                try {
                    ticketChannel = await interaction.guild.channels.create({
                        name: ticketNamePrefix, // HIER WIRD NUR DER BENUTZERNAME VERWENDET
                        type: ChannelType.GuildText,
                        parent: categoryIdToUse, // HIER WIRD DIE SPEZIFISCHE KATEGORIE-ID VERWENDET
                        topic: `Ticket von ${interaction.user.tag} (${ticketCreatorId}). Grund: ${selectedReason}`,
                        permissionOverwrites: [
                            {
                                id: EVERYONE_ROLE_ID,
                                deny: [PermissionsBitField.Flags.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                            },
                            {
                                id: SUPPORT_ROLE_ID,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                            }
                        ]
                    });
                    await saveAndLog(`Ticket-Kanal "${ticketChannel.name}" von ${interaction.user.tag} (Grund: ${selectedReason}) erstellt.`);
                } catch (createError) {
                    console.error(`Fehler beim Erstellen des Ticket-Kanals:`, createError);
                    if (createError.code === 50013) {
                        await interaction.followUp({ content: 'Ich konnte dein Ticket nicht erstellen, da mir die nötigen Berechtigungen (z.B. "Kanäle verwalten") fehlen. Bitte informiere einen Administrator!', ephemeral: true });
                    } else if (createError.code === 50001) { // Missing Access
                         await interaction.followUp({ content: 'Ich konnte dein Ticket nicht erstellen, da ich keinen Zugriff auf die angegebene Kategorie habe oder sie nicht existiert. Bitte informiere einen Administrator!', ephemeral: true });
                    }
                    else {
                        await interaction.followUp({ content: 'Beim Erstellen deines Tickets ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.', ephemeral: true });
                    }
                    return;
                }

                const ticketEmbed = new EmbedBuilder()
                    .setTitle(`Support Ticket für ${interaction.user.tag}`)
                    .setDescription(`**Grund:** ${selectedReason.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}\n\nBitte beschreibe dein Anliegen so detailliert wie möglich. Ein Support-Mitarbeiter wird sich bald bei dir melden.`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Klicke auf 🔒 um das Ticket zu schließen. Klicke auf 🤝 um das Ticket zu beanspruchen.' });

                const closeAndClaimButtonsRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Ticket schließen')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒'),
                        new ButtonBuilder()
                            .setCustomId('claim_ticket')
                            .setLabel('Ticket beanspruchen')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🤝')
                    );

                try {
                    await ticketChannel.send({
                        content: `<@${interaction.user.id}> <@&${SUPPORT_ROLE_ID}>`, embeds: [ticketEmbed], components: [closeAndClaimButtonsRow]
                    });
                    await saveAndLog(`Willkommensnachricht im Ticket-Kanal ${ticketChannel.name} gesendet.`);
                } catch (sendError) {
                    console.error(`Fehler beim Senden der Willkommensnachricht im Ticket-Kanal:`, sendError);
                    await interaction.followUp({ content: `Dein Ticket wurde erstellt: ${ticketChannel}, aber ich konnte die Willkommensnachricht nicht senden.`, ephemeral: true });
                    return;
                }
                await interaction.followUp({ content: `Dein Ticket wurde erstellt: ${ticketChannel}`, ephemeral: true });
            } catch (mainOpenError) {
                console.error(`SCHWERWIEGENDER UNBEHANDELTER FEHLER im open_ticket Prozess:`, mainOpenError);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Es ist ein unerwarteter Fehler beim Ticket-System aufgetreten. Bitte informiere einen Administrator.', ephemeral: true });
                } else if (interaction.deferred) {
                    await interaction.followUp({ content: 'Es ist ein unerwarteter Fehler beim Ticket-System aufgetreten, nachdem dein Ticket angefragt wurde. Bitte informiere einen Administrator.', ephemeral: true });
                }
            }
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            try {
                await interaction.deferUpdate();
                const isModerator = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
                const ticketCreatorId = interaction.channel.topic ? interaction.channel.topic.match(/\((\d+)\)/) : null;
                const isTicketCreator = ticketCreatorId && ticketCreatorId[1] === interaction.user.id;

                if (!isModerator && !isTicketCreator) {
                    return interaction.followUp({ content: 'Du hast nicht die Berechtigung, dieses Ticket zu schließen!', ephemeral: true });
                }

                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket_disabled')
                            .setLabel('Ticket wird geschlossen...')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    );
                try {
                    await interaction.editReply({ components: [disabledRow] });
                } catch (editError) {
                    console.error(`Fehler beim Deaktivieren des Buttons:`, editError);
                }

                try {
                    await interaction.channel.send('Dieses Ticket wird in Kürze geschlossen...');
                } catch (sendError) {
                    console.error(`Fehler beim Senden der Schließungsnachricht:`, sendError);
                }

                setTimeout(async () => {
                    const channelName = interaction.channel.name;
                    await createAndSendTranscript(interaction.channel, interaction.user);
                    try {
                        await interaction.channel.delete('Ticket geschlossen');
                        await saveAndLog(`Ticket-Kanal "${channelName}" von ${interaction.user.tag} geschlossen.`);
                    } catch (deleteError) {
                        console.error(`Fehler beim Löschen des Tickets ${channelName}:`, deleteError);
                    }
                }, 5000);

            } catch (mainCloseError) {
                console.error(`SCHWERWIEGENDER UNBEHANDELTER FEHLER im close_ticket Prozess:`, mainCloseError);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Es ist ein unerwarteter Fehler beim Schließen des Tickets aufgetreten. Bitte informiere einen Administrator.', ephemeral: true });
                } else if (interaction.deferred) {
                    await interaction.followUp({ content: 'Es ist ein unerwarteter Fehler beim Schließen deines Tickets aufgetreten. Bitte informiere einen Administrator.', ephemeral: true });
                }
            }
        } else if (interaction.customId === 'claim_ticket') {
            await interaction.deferUpdate();

            if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
                return interaction.followUp({ content: 'Du hast nicht die Berechtigung, dieses Ticket zu beanspruchen!', ephemeral: true });
            }

            const currentChannel = interaction.channel;

            // Hole den Ersteller des Tickets aus dem Topic
            const ticketCreatorMatch = currentChannel.topic ? currentChannel.topic.match(/Ticket von .* \((\d+)\)\. Grund: (.+)/) : null;
            const ticketCreatorId = ticketCreatorMatch ? ticketCreatorMatch[1] : null;
            const selectedReason = ticketCreatorMatch ? ticketCreatorMatch[2] : 'unknown_reason'; // Den Grund speichern
            let originalTicketCreatorUsername = "unbekannt";

            if (ticketCreatorId) {
                const creatorMember = await currentChannel.guild.members.fetch(ticketCreatorId).catch(() => null);
                if (creatorMember) {
                    originalTicketCreatorUsername = creatorMember.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
                }
            } else {
                // Fallback, falls der Ersteller nicht im Topic gefunden wird (z.B. bei alten Tickets)
                // Versuche, den Namen aus dem aktuellen Kanalnamen zu extrahieren, wenn er dem alten Format entspricht
                let nameParts = currentChannel.name.split('-');
                if (nameParts[0] === 'ticket' && nameParts.length > 1) { // Nur ticket-benutzername oder ticket-benutzername-kategorie
                    originalTicketCreatorUsername = nameParts[1];
                } else {
                    originalTicketCreatorUsername = currentChannel.name; // Wenn kein Schema erkennbar, nimm den ganzen Namen
                }
            }

            // Setze den neuen Kanalnamen: ✅-benutzername
            const newTicketName = `✅-${originalTicketCreatorUsername}`;

            try {
                await currentChannel.edit({ name: newTicketName });
                await saveAndLog(`Ticket-Kanal "${currentChannel.name}" von ${interaction.user.tag} beansprucht. Neuer Name: ${newTicketName}`);

                const embed = new EmbedBuilder()
                    .setDescription(`Dieses Ticket wurde von ${interaction.user} beansprucht.`)
                    .setColor(0x00FF00);

                await currentChannel.send({ embeds: [embed] });
                await interaction.followUp({ content: `Du hast das Ticket erfolgreich beansprucht. Der Kanalname wurde aktualisiert zu #${newTicketName}.`, ephemeral: true });

                const updatedRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Ticket schließen')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒'),
                        new ButtonBuilder()
                            .setCustomId('release_ticket') // NEUER BUTTON: TICKET FREIGEBEN
                            .setLabel('Ticket freigeben')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🔓')
                    );
                // Bearbeite die ursprüngliche Nachricht, um den Button zu aktualisieren
                await interaction.message.edit({ components: [updatedRow] });

            } catch (error) {
                console.error('Fehler beim Beanspruchen des Tickets:', error);
                await interaction.followUp({ content: `Es gab einen Fehler beim Beanspruchen des Tickets: ${error.message}.`, ephemeral: true });
            }
        } else if (interaction.customId === 'release_ticket') { // NEUE LOGIK FÜR "TICKET FREIGEBEN"
            await interaction.deferUpdate();

            if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
                return interaction.followUp({ content: 'Du hast nicht die Berechtigung, dieses Ticket freizugeben!', ephemeral: true });
            }

            const currentChannel = interaction.channel;

            // Hole den Ersteller des Tickets und den Grund aus dem Topic
            const ticketCreatorMatch = currentChannel.topic ? currentChannel.topic.match(/Ticket von .* \((\d+)\)\. Grund: (.+)/) : null;
            const ticketCreatorId = ticketCreatorMatch ? ticketCreatorMatch[1] : null;
            const selectedReason = ticketCreatorMatch ? ticketCreatorMatch[2] : 'general_inquiry'; // Fallback

            let originalTicketCreatorUsername = "unbekannt";
            if (ticketCreatorId) {
                const creatorMember = await currentChannel.guild.members.fetch(ticketCreatorId).catch(() => null);
                if (creatorMember) {
                    originalTicketCreatorUsername = creatorMember.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
                }
            } else {
                // Fallback, falls der Ersteller nicht im Topic gefunden wird
                // Wenn der Name mit ✅- beginnt, versuchen wir, den ursprünglichen Teil zu extrahieren
                if (currentChannel.name.startsWith('✅-')) {
                    originalTicketCreatorUsername = currentChannel.name.substring('✅-'.length);
                    // Wenn der ursprüngliche Name nur den Benutzernamen enthielt, behalten wir ihn
                } else {
                    originalTicketCreatorUsername = currentChannel.name;
                }
            }
            // Der ursprüngliche Kanalname war nur der Benutzername, basierend auf der letzten Änderung.
            const originalTicketName = `ticket-${originalTicketCreatorUsername}`;

            try {
                await currentChannel.edit({ name: originalTicketName });
                await saveAndLog(`Ticket-Kanal "${currentChannel.name}" von ${interaction.user.tag} freigegeben. Neuer Name: ${originalTicketName}`);

                const embed = new EmbedBuilder()
                    .setDescription(`Dieses Ticket wurde von ${interaction.user} freigegeben.`)
                    .setColor(0xFFA500); // Orange Farbe für Freigabe

                await currentChannel.send({ embeds: [embed] });
                await interaction.followUp({ content: `Du hast das Ticket erfolgreich freigegeben. Der Kanalname wurde aktualisiert zu #${originalTicketName}.`, ephemeral: true });

                const updatedRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Ticket schließen')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒'),
                        new ButtonBuilder()
                            .setCustomId('claim_ticket') // ZURÜCK ZUM "BEANSPRUCHEN"-BUTTON
                            .setLabel('Ticket beanspruchen')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🤝')
                    );
                // Bearbeite die ursprüngliche Nachricht, um den Button zu aktualisieren
                await interaction.message.edit({ components: [updatedRow] });

            } catch (error) {
                console.error('Fehler beim Freigeben des Tickets:', error);
                await interaction.followUp({ content: `Es gab einen Fehler beim Freigeben des Tickets: ${error.message}.`, ephemeral: true });
            }
        } else if (interaction.customId === 'verify_button') {
            await interaction.deferReply({ ephemeral: true });
            const member = interaction.member;
            try {
                if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    return interaction.followUp({ content: 'Du bist bereits verifiziert!', ephemeral: true });
                }

                await member.roles.add(VERIFIED_ROLE_ID);
                await member.roles.remove(UNVERIFIED_ROLE_ID);
                await interaction.followUp({ content: 'Du wurdest erfolgreich verifiziert!', ephemeral: true });
                await saveAndLog(`${member.user.tag} hat sich erfolgreich verifiziert.`);

                const welcomeChannel = interaction.guild.channels.cache.get(WELCOME_CHANNEL_ID);
                if (welcomeChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('Willkommen bei Apex Systems!')
                        .setDescription(`Herzlich willkommen auf dem Server, ${member}! Wir freuen uns, dich hier zu haben.`)
                        .setColor(0x00FF00)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                }
            } catch (error) {
                console.error('Fehler bei der Verifizierung:', error);
                await interaction.followUp({ content: `Es gab einen Fehler bei der Verifizierung: ${error.message}. Bitte kontaktiere einen Administrator.`, ephemeral: true });
                await saveAndLog(`Fehler bei der Verifizierung von ${member.user.tag}: ${error.message}`);
            }
        }
    }
});


// Begrüßungsnachricht für neue Mitglieder
client.on('guildMemberAdd', async member => {
    // Weisen Sie dem neuen Mitglied die "unverified" Rolle zu
    if (UNVERIFIED_ROLE_ID) {
        try {
            await member.roles.add(UNVERIFIED_ROLE_ID);
            console.log(`Rolle 'Unverified' an ${member.user.tag} vergeben.`);
        } catch (error) {
            console.error(`Fehler beim Zuweisen der 'Unverified'-Rolle an ${member.user.tag}:`, error);
        }
    } else {
        console.warn('UNVERIFIED_ROLE_ID ist nicht definiert. Rolle kann nicht zugewiesen werden.');
    }

    // Sende das Willkommens-Embed in den Verifizierungskanal
    const verificationChannel = member.guild.channels.cache.get(VERIFICATION_CHANNEL_ID);
    if (verificationChannel) {
        const embed = new EmbedBuilder()
            .setTitle('Willkommen bei Apex Systems!')
            .setDescription(`Hallo ${member}! Um vollen Zugriff auf den Server zu erhalten, klicke bitte auf den Button unten, um dich zu verifizieren.`)
            .setColor('#0099ff')
            .setFooter({ text: 'Verifizierung erforderlich' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_button')
                    .setLabel('Verifizieren')
                    .setStyle(ButtonStyle.Success)
            );

        await verificationChannel.send({ content: `${member}`, embeds: [embed], components: [row] });
        console.log(`Willkommensnachricht für ${member.user.tag} in ${verificationChannel.name} gesendet.`);
    } else {
        console.warn(`Verifizierungskanal mit ID ${VERIFICATION_CHANNEL_ID} nicht gefunden.`);
    }
    await saveAndLog(`Neues Mitglied ${member.user.tag} beigetreten. (ID: ${member.id})`);
});


async function sendVerificationPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle('Server Verifizierung')
        .setDescription('Klicke auf den Button unten, um dich zu verifizieren und vollen Zugriff auf den Server zu erhalten.')
        .setColor('#0099ff')
        .setFooter({ text: 'Apex Systems | Verifizierung' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verifizieren')
                .setStyle(ButtonStyle.Success)
        );

    await channel.send({ embeds: [embed], components: [row] });
    console.log(`Verifizierungspanel in ${channel.name} gesendet.`);
}

client.on('voiceStateUpdate', async (oldState, newState) => {
    // Überprüfen, ob der Benutzer einen Sprachkanal betreten hat (von null zu einem Kanal)
    if (!oldState.channelId && newState.channelId) {
        const member = newState.member;
        const channel = newState.channel;

        // Sicherstellen, dass der Benutzer nicht der Bot ist und eine Rolle zum Pingen vorhanden ist
        if (!member.user.bot && VOICE_PING_ROLE_ID) {
            // Überprüfen, ob der Benutzer die VOICE_PING_ROLE_ID hat
            if (member.roles.cache.has(VOICE_PING_ROLE_ID)) {
                const pingChannel = member.guild.channels.cache.get(VOICE_PING_CHANNEL_ID);

                if (pingChannel && pingChannel.type === ChannelType.GuildText) {
                    try {
                        const embed = new EmbedBuilder()
                            .setColor(0x00AE86)
                            .setTitle('Sprachkanal-Beitritt')
                            .setDescription(`${member} ist dem Sprachkanal \`${channel.name}\` beigetreten!`)
                            .setTimestamp();

                        await pingChannel.send({
                            content: `<@&${VOICE_PING_ROLE_ID}>`, // Rolle pingen
                            embeds: [embed]
                        });
                        await saveAndLog(`${member.user.tag} ist dem Sprachkanal ${channel.name} beigetreten und hat die Voice-Ping-Rolle.`);
                    } catch (error) {
                        console.error('Fehler beim Senden der Sprachkanal-Ping-Nachricht:', error);
                        await saveAndLog(`Fehler beim Senden der Sprachkanal-Ping-Nachricht für ${member.user.tag}: ${error.message}`);
                    }
                }
            }
        }
    }
});


// Registrieren der Slash-Befehle
client.on(Events.ClientReady, async () => {
    if (client.application) {
        try {
            await client.application.commands.set([
                {
                    name: 'sendticketpanel',
                    description: 'Sendet das Ticket-Panel in den aktuellen Kanal.',
                },
                {
                    name: 'sendverificationpanel',
                    description: 'Sendet das Verifizierungspanel in den Verifizierungskanal.',
                },
                {
                    name: 'create-embed',
                    description: 'Erstellt und sendet ein benutzerdefiniertes Embed.',
                    options: [
                        { name: 'channel', description: 'Der Kanal, in den das Embed gesendet werden soll.', type: ApplicationCommandOptionType.Channel, channel_types: [ChannelType.GuildText], required: false },
                        { name: 'title', description: 'Der Titel des Embeds.', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'description', description: 'Die Beschreibung des Embeds.', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'color', description: 'Die Farbe des Embeds (Hex-Code, z.B. #FF0000 oder FF0000).', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'footer', description: 'Der Footer-Text des Embeds.', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'image', description: 'Eine URL für ein Hauptbild im Embed.', type: ApplicationCommandOptionType.String, required: false },
                        { name: 'thumbnail', description: 'Eine URL für ein kleines Thumbnail-Bild oben rechts im Embed.', type: ApplicationCommandOptionType.String, required: false },
                    ],
                },
                {
                    name: 'search-logs',
                    description: 'Sucht in den letzten Bot-Logs nach einem Stichwort.',
                    options: [
                        {
                            name: 'query',
                            description: 'Das Stichwort, nach dem in den Logs gesucht werden soll.',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                        },
                    ],
                }
            ]);
            console.log('Globale Slash-Befehle registriert (dauert bis zu 1 Stunde).');
        } catch (error) {
            console.error('Fehler beim globalen Registrieren der Slash-Befehle:', error);
        }
    }
});


client.login(TOKEN).catch(error => {
    console.error('FEHLER: Bot konnte sich nicht anmelden! Überprüfe deinen DISCORD_TOKEN in der .env-Datei:', error);
    process.exit(1);
});