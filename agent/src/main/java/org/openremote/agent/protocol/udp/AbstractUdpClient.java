/*
 * Copyright 2017, OpenRemote Inc.
 *
 * See the CONTRIBUTORS.txt file in the distribution for a
 * full listing of individual contributors.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
package org.openremote.agent.protocol.udp;

import io.netty.buffer.ByteBuf;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.DatagramPacket;
import io.netty.channel.socket.nio.NioDatagramChannel;
import io.netty.handler.codec.MessageToMessageDecoder;
import io.netty.handler.codec.MessageToMessageEncoder;
import org.openremote.agent.protocol.ProtocolExecutorService;
import org.openremote.agent.protocol.io.AbstractNettyIoClient;
import org.openremote.agent.protocol.io.IoClient;
import org.openremote.model.syslog.SyslogCategory;
import org.openremote.model.util.TextUtil;

import java.net.InetSocketAddress;
import java.util.List;
import java.util.logging.Logger;

import static org.openremote.model.syslog.SyslogCategory.PROTOCOL;

/**
 * This is a {@link IoClient} implementation for UDP.
 */
public abstract class AbstractUdpClient<T> extends AbstractNettyIoClient<T, InetSocketAddress> {

    private static final Logger LOG = SyslogCategory.getLogger(PROTOCOL, AbstractUdpClient.class);
    protected String host;
    protected int port;
    protected int bindPort;

    public AbstractUdpClient(String host, int port, ProtocolExecutorService executorService) {
        this(host, port, null, executorService);
    }

    public AbstractUdpClient(String host, int port, Integer bindPort, ProtocolExecutorService executorService) {
        super(executorService);
        TextUtil.requireNonNullAndNonEmpty(host);

        if (port < 1 || port > 65536) {
            throw new IllegalArgumentException("Port must be between 1 and 65536");
        }

        if (bindPort == null) {
            bindPort = 0;
        } else if (bindPort < 1 || bindPort > 65536) {
            throw new IllegalArgumentException("Bind port must be between 1 and 65536");
        }

        this.host = host;
        this.port = port;
        this.bindPort = bindPort;
    }

    @Override
    protected void addEncoders(Channel channel) {
        channel.pipeline().addLast(new MessageToMessageEncoder<ByteBuf>() {
            @Override
            protected void encode(ChannelHandlerContext ctx, ByteBuf msg, List<Object> out) throws Exception {
                out.add(new DatagramPacket(msg.retain(), new InetSocketAddress(host, port)));
            }
        });

        super.addEncoders(channel);
    }

    @Override
    protected void addDecoders(Channel channel) {
        super.addDecoders(channel);

        channel.pipeline().addFirst(new MessageToMessageDecoder<DatagramPacket>() {
            @Override
            protected void decode(ChannelHandlerContext ctx, DatagramPacket msg, List<Object> out) throws Exception {
                out.add(msg.content().retain());
            }
        });
    }

    @Override
    protected ChannelFuture startChannel() {
        return bootstrap.bind(bindPort);
    }

    @Override
    protected Class<? extends Channel> getChannelClass() {
        return NioDatagramChannel.class;
    }

    @Override
    protected String getSocketAddressString() {
        return "udp://" + host + ":" + port + " (bindPort: " + bindPort + ")";
    }

    @Override
    protected EventLoopGroup getWorkerGroup() {
        return new NioEventLoopGroup(1);
    }

    @Override
    protected void configureChannel() {
        super.configureChannel();
        //bootstrap.option(ChannelOption.SO_BROADCAST, true);
    }

    @Override
    protected synchronized void scheduleReconnect() {
        // No connection to reconnect
    }
}
