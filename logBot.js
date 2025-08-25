const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js'); // ChannelType hinzugefügt

module.exports = (client, logChannelId) => {
    if (!logChannelId) {
        console.error('FEHLER: Keine Log-Kanal-ID für den Log-Bot angegeben. Logs werden nicht gesendet.');
        return;
    }

    // Event: Nachricht bearbeitet
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.author.bot || oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor('#FFD700') // Gold
            .setTitle('Nachricht bearbeitet')
            .addFields(
                { name: 'Kanal', value: newMessage.channel.name, inline: true },
                { name: 'Benutzer', value: newMessage.author.tag, inline: true },
                { name: 'Vorher', value: `\`\`\`${oldMessage.content.substring(0, 1020)}\`\`\``, inline: false },
                { name: 'Nachher', value: `\`\`\`${newMessage.content.substring(0, 1020)}\`\`\``, inline: false },
                { name: 'Link zur Nachricht', value: `[Hier klicken](${newMessage.url})` }
            )
            .setTimestamp();
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Nachricht gelöscht
    client.on('messageDelete', async message => {
        if (message.author && message.author.bot) return; // Ignoriere Bot-Nachrichten

        const embed = new EmbedBuilder()
            .setColor('#FF0000') // Rot
            .setTitle('Nachricht gelöscht')
            .addFields(
                { name: 'Kanal', value: message.channel.name, inline: true },
                { name: 'Benutzer', value: message.author ? message.author.tag : 'Unbekannt', inline: true }
            )
            .setTimestamp();

        if (message.content) {
            embed.addFields({ name: 'Inhalt', value: `\`\`\`${message.content.substring(0, 1020)}\`\`\``, inline: false });
        }
        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Anhänge', value: message.attachments.map(att => att.name).join(', '), inline: false });
        }

        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Kanal erstellt
    client.on('channelCreate', async channel => {
        if (!channel.guild) return; // Nur Guild-Kanäle loggen
        const embed = new EmbedBuilder()
            .setColor('#00FF00') // Grün
            .setTitle('Kanal erstellt')
            .setDescription(`Der Kanal **#${channel.name}** (${channel.type}) wurde erstellt.`)
            .setTimestamp();
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Kanal gelöscht
    client.on('channelDelete', async channel => {
        if (!channel.guild) return; // Nur Guild-Kanäle loggen
        const embed = new EmbedBuilder()
            .setColor('#FF0000') // Rot
            .setTitle('Kanal gelöscht')
            .setDescription(`Der Kanal **#${channel.name}** (${channel.type}) wurde gelöscht.`)
            .setTimestamp();
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Kanal aktualisiert
    client.on('channelUpdate', async (oldChannel, newChannel) => {
        if (!newChannel.guild) return; // Nur Guild-Kanäle loggen
        const embed = new EmbedBuilder()
            .setColor('#00BFFF') // Tiefes Himmelblau
            .setTitle('Kanal aktualisiert')
            .setTimestamp();

        let description = `Kanal **#${oldChannel.name}** (${oldChannel.type}) wurde aktualisiert.`;

        if (oldChannel.name !== newChannel.name) {
            description += `\nName geändert von \`${oldChannel.name}\` zu \`${newChannel.name}\`.`;
            embed.addFields({ name: 'Alter Name', value: oldChannel.name, inline: true }, { name: 'Neuer Name', value: newChannel.name, inline: true });
        }
        if (oldChannel.topic !== newChannel.topic) {
            description += `\nTopic geändert.`;
            embed.addFields({ name: 'Altes Topic', value: oldChannel.topic || 'Kein Topic', inline: false }, { name: 'Neues Topic', value: newChannel.topic || 'Kein Topic', inline: false });
        }
        if (oldChannel.parent && newChannel.parent && oldChannel.parent.id !== newChannel.parent.id) {
            description += `\nKategorie geändert von \`${oldChannel.parent.name}\` zu \`${newChannel.parent.name}\`.`;
            embed.addFields({ name: 'Alte Kategorie', value: oldChannel.parent.name, inline: true }, { name: 'Neue Kategorie', value: newChannel.parent.name, inline: true });
        } else if (!oldChannel.parent && newChannel.parent) {
            description += `\nKanal zu Kategorie \`${newChannel.parent.name}\` hinzugefügt.`;
            embed.addFields({ name: 'Neue Kategorie', value: newChannel.parent.name, inline: true });
        } else if (oldChannel.parent && !newChannel.parent) {
            description += `\nKanal aus Kategorie \`${oldChannel.parent.name}\` entfernt.`;
            embed.addFields({ name: 'Alte Kategorie', value: oldChannel.parent.name, inline: true });
        }

        embed.setDescription(description);
        if (embed.data.fields && embed.data.fields.length > 0 || oldChannel.name !== newChannel.name || oldChannel.topic !== newChannel.topic) {
            client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
        }
    });

    // Event: Rolle erstellt
    client.on('roleCreate', async role => {
        const embed = new EmbedBuilder()
            .setColor('#8A2BE2') // Blauviolett
            .setTitle('Rolle erstellt')
            .setDescription(`Die Rolle **${role.name}** wurde erstellt.`)
            .addFields(
                { name: 'ID', value: role.id, inline: true },
                { name: 'Farbe', value: role.hexColor, inline: true },
                { name: 'Erwähnbar', value: role.mentionable ? 'Ja' : 'Nein', inline: true }
            )
            .setTimestamp();
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Rolle gelöscht
    client.on('roleDelete', async role => {
        const embed = new EmbedBuilder()
            .setColor('#FF4500') // Orangerot
            .setTitle('Rolle gelöscht')
            .setDescription(`Die Rolle **${role.name}** wurde gelöscht.`)
            .addFields(
                { name: 'ID', value: role.id, inline: true }
            )
            .setTimestamp();
        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: Rolle aktualisiert
    client.on('roleUpdate', async (oldRole, newRole) => {
        const embed = new EmbedBuilder()
            .setColor('#DA70D6') // Orchidee
            .setTitle('Rolle aktualisiert')
            .setDescription(`Die Rolle **${oldRole.name}** wurde aktualisiert.`);

        let hasChanges = false;
        if (oldRole.name !== newRole.name) {
            embed.addFields({ name: 'Alter Name', value: oldRole.name, inline: true }, { name: 'Neuer Name', value: newRole.name, inline: true });
            hasChanges = true;
        }
        if (oldRole.hexColor !== newRole.hexColor) {
            embed.addFields({ name: 'Alte Farbe', value: oldRole.hexColor, inline: true }, { name: 'Neue Farbe', value: newRole.hexColor, inline: true });
            hasChanges = true;
        }
        if (oldRole.mentionable !== newRole.mentionable) {
            embed.addFields({ name: 'Alte Erwähnbarkeit', value: oldRole.mentionable ? 'Ja' : 'Nein', inline: true }, { name: 'Neue Erwähnbarkeit', value: newRole.mentionable ? 'Ja' : 'Nein', inline: true });
            hasChanges = true;
        }
        if (!oldRole.permissions.equals(newRole.permissions)) {
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();

            const addedPerms = newPerms.filter(perm => !oldPerms.includes(perm));
            const removedPerms = oldPerms.filter(perm => !newPerms.includes(perm));

            if (addedPerms.length > 0) {
                embed.addFields({ name: 'Berechtigungen hinzugefügt', value: addedPerms.join(', '), inline: false });
                hasChanges = true;
            }
            if (removedPerms.length > 0) {
                embed.addFields({ name: 'Berechtigungen entfernt', value: removedPerms.join(', '), inline: false });
                hasChanges = true;
            }
        }

        embed.setTimestamp();

        if (hasChanges) {
            client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
        }
    });

    // Event: GuildMemberUpdate (Rollen, Spitznamen, etc.)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.user.bot) return; // Ignoriere Bots

        const embed = new EmbedBuilder()
            .setColor('#4169E1') // RoyalBlue
            .setTitle('Mitglied aktualisiert')
            .setDescription(`Das Mitglied ${newMember.user.tag} wurde aktualisiert.`);

        let hasChanges = false;

        // Spitznamen-Änderung
        if (oldMember.nickname !== newMember.nickname) {
            embed.addFields(
                { name: 'Alter Spitzname', value: oldMember.nickname || 'Keiner', inline: true },
                { name: 'Neuer Spitzname', value: newMember.nickname || 'Keiner', inline: true }
            );
            hasChanges = true;
        }

        // Rollen-Änderung
        const oldRoles = oldMember.roles.cache.map(r => r.id).sort();
        const newRoles = newMember.roles.cache.map(r => r.id).sort();

        const addedRoles = newRoles.filter(roleId => !oldRoles.includes(roleId));
        const removedRoles = oldRoles.filter(roleId => !newRoles.includes(roleId));

        if (addedRoles.length > 0) {
            const roleNames = addedRoles.map(id => newMember.guild.roles.cache.get(id)?.name || `Unbekannte Rolle (${id})`);
            embed.addFields({ name: 'Rollen hinzugefügt', value: roleNames.join(', '), inline: false });
            hasChanges = true;
        }
        if (removedRoles.length > 0) {
            const roleNames = removedRoles.map(id => oldMember.guild.roles.cache.get(id)?.name || `Unbekannte Rolle (${id})`);
            embed.addFields({ name: 'Rollen entfernt', value: roleNames.join(', '), inline: false });
            hasChanges = true;
        }

        embed.setTimestamp();

        if (hasChanges) {
            client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
        }
    });

    // Event: GuildMemberRemove (Mitglied hat den Server verlassen)
    client.on('guildMemberRemove', async member => {
        if (member.user.bot) return; // Ignoriere Bots

        const embed = new EmbedBuilder()
            .setColor('#8B0000') // Dunkelrot
            .setTitle('Mitglied hat den Server verlassen')
            .setDescription(`**${member.user.tag}** (${member.id}) hat den Server verlassen oder wurde gekickt.`)
            .addFields(
                { name: 'Beigetreten am', value: member.joinedAt ? new Date(member.joinedAt).toLocaleString('de-DE') : 'Unbekannt', inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: GuildBanAdd (Benutzer gebannt)
    client.on('guildBanAdd', async ban => {
        const embed = new EmbedBuilder()
            .setColor('#B22222') // Feuerziegelrot
            .setTitle('Benutzer gebannt')
            .setDescription(`**${ban.user.tag}** (${ban.user.id}) wurde vom Server gebannt.`)
            .addFields(
                { name: 'Grund', value: ban.reason || 'Kein Grund angegeben', inline: false }
            )
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: GuildBanRemove (Benutzer entbannt)
    client.on('guildBanRemove', async ban => {
        const embed = new EmbedBuilder()
            .setColor('#32CD32') // Limettengrün
            .setTitle('Benutzer entbannt')
            .setDescription(`**${ban.user.tag}** (${ban.user.id}) wurde vom Server entbannt.`)
            .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
    });

    // Event: UserUpdate (Benutzername, Avatar, etc.)
    client.on('userUpdate', async (oldUser, newUser) => {
        if (oldUser.bot) return; // Ignoriere Bots

        const embed = new EmbedBuilder()
            .setColor('#DAA520') // Goldenrod
            .setTitle('Benutzerprofil aktualisiert');

        let hasChanges = false;

        if (oldUser.username !== newUser.username) {
            embed.addFields(
                { name: 'Alter Benutzername', value: oldUser.username, inline: true },
                { name: 'Neuer Benutzername', value: newUser.username, inline: true }
            );
            hasChanges = true;
        }
        if (oldUser.avatar !== newUser.avatar) {
            embed.addFields(
                { name: 'Avatar geändert', value: '[Alter Avatar](' + oldUser.displayAvatarURL({ dynamic: true }) + ')', inline: true },
                { name: 'Neuer Avatar', value: '[Neuer Avatar](' + newUser.displayAvatarURL({ dynamic: true }) + ')', inline: true }
            );
            embed.setThumbnail(newUser.displayAvatarURL({ dynamic: true }));
            hasChanges = true;
        }
        if (oldUser.discriminator !== newUser.discriminator && newUser.discriminator !== '0') { // Discord hat Discriminatoren entfernt, '0' ist der neue Standardwert
             embed.addFields(
                { name: 'Alter Discriminator', value: oldUser.discriminator, inline: true },
                { name: 'Neuer Discriminator', value: newUser.discriminator, inline: true }
            );
            hasChanges = true;
        }

        embed.setTimestamp();
        if (hasChanges) {
            embed.setDescription(`Benutzer **${newUser.tag}** (${newUser.id}) hat sein Profil aktualisiert.`);
            client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
        }
    });

    // Event: voiceStateUpdate (Beitritt/Verlassen von Sprachkanälen, Mute/Deaf)
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const member = oldState.member || newState.member;
        if (member.user.bot) return; // Ignoriere Bots

        const embed = new EmbedBuilder()
            .setColor('#F08080') // Lichtkoralle
            .setTitle('Sprachstatus aktualisiert')
            .setTimestamp();

        let description = `Benutzer **${member.user.tag}** (${member.id}) hat seinen Sprachstatus geändert.`;
        embed.setDescription(description);

        if (!oldState.channelId && newState.channelId) {
            // Beitritt zu einem Sprachkanal
            embed.addFields(
                { name: 'Aktion', value: 'Beigetreten', inline: true },
                { name: 'Kanal', value: newState.channel.name, inline: true }
            );
        } else if (oldState.channelId && !newState.channelId) {
            // Verlassen eines Sprachkanals
            embed.addFields(
                { name: 'Aktion', value: 'Verlassen', inline: true },
                { name: 'Kanal', value: oldState.channel.name, inline: true }
            );
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // Kanal gewechselt
            embed.addFields(
                { name: 'Aktion', value: 'Kanal gewechselt', inline: true },
                { name: 'Alter Kanal', value: oldState.channel.name, inline: true },
                { name: 'Neuer Kanal', value: newState.channel.name, inline: true }
            );
        } else {
            // Mute/Deaf/Stream/Video Änderungen im selben Kanal
            if (oldState.streaming !== newState.streaming) embed.addFields({ name: 'Streaming', value: newState.streaming ? 'An' : 'Aus', inline: true });
            if (oldState.selfVideo !== newState.selfVideo) embed.addFields({ name: 'Video', value: newState.selfVideo ? 'An' : 'Aus', inline: true });
            if (oldState.selfMute !== newState.selfMute) embed.addFields({ name: 'Self-Mute', value: newState.selfMute ? 'An' : 'Aus', inline: true });
            if (oldState.selfDeaf !== newState.selfDeaf) embed.addFields({ name: 'Self-Deafen', value: newState.selfDeaf ? 'An' : 'Aus', inline: true });
            if (oldState.serverMute !== newState.serverMute) embed.addFields({ name: 'Server-Mute', value: newState.serverMute ? 'An' : 'Aus', inline: true });
            if (oldState.serverDeaf !== newState.serverDeaf) embed.addFields({ name: 'Server-Deafen', value: newState.serverDeaf ? 'An' : 'Aus', inline: true });
        }

        // Sende das Embed nur, wenn eine relevante Änderung stattgefunden hat
        if (embed.data.title && (embed.data.description || embed.data.fields?.length > 0)) {
            client.channels.cache.get(logChannelId)?.send({ embeds: [embed] }).catch(console.error);
        }
    });

    // Funktion zum Senden einer Log-Nachricht
    const log = async (message, embed = null, components = []) => {
        const logChannel = client.channels.cache.get(logChannelId);
        if (logChannel) {
            try {
                if (embed) {
                    await logChannel.send({ content: message, embeds: [embed], components: components });
                } else {
                    await logChannel.send(message);
                }
            } catch (error) {
                console.error('Fehler beim Senden der Log-Nachricht:', error);
            }
        } else {
            console.error(`Log-Kanal mit ID ${logChannelId} nicht gefunden. Nachricht: ${message}`);
        }
    };

    return log; // Gebe die log-Funktion zurück
};