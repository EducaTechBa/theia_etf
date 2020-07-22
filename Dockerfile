FROM node:10.21.0

RUN apt -y update && apt -y install vim curl git build-essential gdb sudo
# RUN npm install -g yarn

# Add User
ENV USER=theia
ENV GROUP=theia
ENV HOME=/home/${USER}
ENV PASSWORD=theia

RUN mkdir -p ${HOME}
RUN groupadd -r ${GROUP} && \
    useradd -r -g ${GROUP} -d ${HOME} -s /sbin/nologin -c "Docker image user" ${USER} && \
    chown ${USER}:${GROUP} ${HOME} && \
    usermod -a -G sudo ${USER} && \
		echo "${PASSWORD}\n${PASSWORD}" | passwd ${USER}

USER ${USER}

EXPOSE 3000
RUN mkdir ${HOME}/app
WORKDIR ${HOME}/app
# COPY --chown=${USER}:${GROUP} . .
RUN git clone https://github.com/rfejzic1/theia_etf.git .
# RUN ./build.sh
# CMD ./start.sh --hostname=0.0.0.0
CMD tail -f /dev/null
# RUN yarn && yarn theia build
# CMD yarn start --hostname=0.0.0.0
